import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { Card, Text, Button, ListItem, Icon, Badge, Tab, TabView } from '@rneui/themed';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { getForms, getFormResponses } from '../../../utils/database/forms';
import { getActiveVisit } from '../../../utils/database/visits';

export default function FormsScreen() {
  const [forms, setForms] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const router = useRouter();
  const { user } = useAuth();

  const isController = user?.roles?.some(r => r.name === 'controlador');
  const isRegularUser = !user?.isAdmin && !isController;

  const loadForms = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check for active visit first
      if (user) {
        const visit = await getActiveVisit(user.id);
        console.log('[FormsScreen] Active visit:', visit);
        setActiveVisit(visit);

        // For regular users, only load forms if there's an active visit
        if (isRegularUser) {
          if (!visit) {
            console.log('[FormsScreen] No active visit for regular user');
            setForms([]);
            setLoading(false);
            return;
          }
          // Load forms specifically for the active visit's company
          console.log('[FormsScreen] Loading forms for company:', visit.company_id);
          const formsData = await getForms(user.id, visit.company_id);
          console.log('[FormsScreen] Loaded forms:', formsData);
          setForms(formsData);
        } else {
          // For admin/controller, load all forms
          console.log('[FormsScreen] Loading all forms for admin/controller');
          const formsData = await getForms(user.id);
          console.log('[FormsScreen] Loaded forms:', formsData);
          setForms(formsData);
        }

        // Load responses if user is admin or controller
        if (user.isAdmin || isController) {
          console.log('[FormsScreen] Loading responses for admin/controller');
          const responsesData = await getFormResponses();
          console.log('[FormsScreen] Loaded responses:', responsesData);
          setResponses(responsesData);
        }
      }
    } catch (error) {
      console.error('[FormsScreen] Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isRegularUser, isController]);

  useFocusEffect(
    useCallback(() => {
      loadForms();
    }, [loadForms])
  );

  const handleCreateForm = () => {
    router.push('/forms/create');
  };

  const handleFormPress = (formId: string) => {
    if (!activeVisit && isRegularUser) {
      Alert.alert('No Active Visit', 'You need an active visit to fill out forms.');
      return;
    }
    router.push(`/forms/${formId}`);
  };

  const handleViewResponses = (formId: string) => {
    router.push(`/forms/responses/${formId}`);
  };

  const renderAdminFormItem = (form: any) => (
    <Card key={form.id} containerStyle={styles.formCard}>
      <Card.Title style={styles.formTitle}>{form.name}</Card.Title>
      <Card.Divider />
      <Text style={styles.description}>{form.description}</Text>
      <Text style={styles.formDate}>
        Created: {new Date(form.created_at).toLocaleDateString()}
      </Text>
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Fields: {form.fields?.length || 0}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="View Responses"
          onPress={() => handleViewResponses(form.id)}
          type="outline"
          containerStyle={styles.buttonHalf}
        />
        <Button
          title="Edit Form"
          onPress={() => handleFormPress(form.id)}
          containerStyle={styles.buttonHalf}
        />
      </View>
    </Card>
  );

  const renderUserFormItem = (form: any) => (
    <ListItem
      key={form.id}
      onPress={() => handleFormPress(form.id.toString())}
      containerStyle={[
        styles.listItem,
        !activeVisit && isRegularUser && styles.listItemDisabled
      ]}
      disabled={!activeVisit && isRegularUser}
    >
      <Icon name="description" type="material" />
      <ListItem.Content>
        <ListItem.Title style={styles.formTitle}>{form.name}</ListItem.Title>
        <ListItem.Subtitle>{form.description}</ListItem.Subtitle>
        <Text style={styles.formDate}>
          Created: {new Date(form.created_at).toLocaleDateString()}
        </Text>
      </ListItem.Content>
      <Badge value={form.fields?.length || 0} status="primary" />
      <ListItem.Chevron />
    </ListItem>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Forms</Card.Title>
          <Card.Divider />
          <Text style={styles.webMessage}>
            Forms are only available in the mobile app.
          </Text>
        </Card>
      </View>
    );
  }

  // Show admin/controller view for both admin and controller roles
  if (user?.isAdmin || isController) {
    return (
      <View style={styles.container}>
        <Tab
          value={tabIndex}
          onChange={setTabIndex}
          indicatorStyle={{ backgroundColor: '#f4511e' }}
        >
          <Tab.Item title="Forms" titleStyle={styles.tabTitle} />
          <Tab.Item title="Responses" titleStyle={styles.tabTitle} />
        </Tab>

        <TabView value={tabIndex} onChange={setTabIndex} animationType="spring">
          <TabView.Item style={styles.tabContent}>
            <ScrollView>
              <View style={styles.header}>
                <Button
                  title="Create New Form"
                  onPress={handleCreateForm}
                  icon={{
                    name: 'add',
                    type: 'ionicon',
                    color: 'white',
                  }}
                  containerStyle={styles.createButton}
                />
              </View>
              {loading ? (
                <Text style={styles.loadingText}>Loading forms...</Text>
              ) : forms.length === 0 ? (
                <Text style={styles.noFormsText}>No forms available</Text>
              ) : (
                forms.map(form => renderAdminFormItem(form))
              )}
            </ScrollView>
          </TabView.Item>

          <TabView.Item style={styles.tabContent}>
            <ScrollView>
              {loading ? (
                <Text style={styles.loadingText}>Loading responses...</Text>
              ) : responses.length === 0 ? (
                <Text style={styles.noFormsText}>No responses available</Text>
              ) : (
                responses.map(response => (
                  <Card key={response.id} containerStyle={styles.responseCard}>
                    <View style={styles.responseHeader}>
                      <Text style={styles.responseTitle}>{response.formName}</Text>
                      <Text style={styles.responseDate}>
                        {new Date(response.created_at).toLocaleString()}
                      </Text>
                    </View>
                    <Card.Divider />
                    <Text style={styles.responseUser}>By: {response.username}</Text>
                    {response.responses.map((r: any, index: number) => (
                      <View key={index} style={styles.responseItem}>
                        <Text style={styles.responseLabel}>{r.fieldLabel}:</Text>
                        <Text style={styles.responseValue}>{r.value}</Text>
                      </View>
                    ))}
                  </Card>
                ))
              )}
            </ScrollView>
          </TabView.Item>
        </TabView>
      </View>
    );
  }

  // Regular user view
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card containerStyle={styles.card}>
          <Card.Title style={styles.cardTitle}>Forms</Card.Title>
          <Card.Divider />
          
          {!activeVisit ? (
            <View style={styles.warningContainer}>
              <Icon name="warning" type="material" color="#f4511e" size={24} />
              <Text style={styles.warningText}>
                Start a visit to fill out forms
              </Text>
            </View>
          ) : (
            <View style={styles.activeVisitInfo}>
              <Icon name="business" type="material" color="#4CAF50" size={24} />
              <Text style={styles.activeVisitText}>
                Active visit: {activeVisit.company_name}
              </Text>
            </View>
          )}

          {loading ? (
            <Text style={styles.loadingText}>Loading forms...</Text>
          ) : forms.length === 0 ? (
            <Text style={styles.noFormsText}>
              {!activeVisit 
                ? 'Start a visit to see available forms'
                : 'No forms available for this company'}
            </Text>
          ) : (
            forms.map(form => renderUserFormItem(form))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
  },
  createButton: {
    marginBottom: 16,
  },
  tabContent: {
    width: '100%',
  },
  tabTitle: {
    fontSize: 14,
    color: '#f4511e',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    borderRadius: 10,
    marginHorizontal: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  formCard: {
    marginBottom: 16,
    borderRadius: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  formDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 16,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  buttonHalf: {
    flex: 1,
  },
  listItem: {
    borderRadius: 8,
    marginVertical: 4,
  },
  listItemDisabled: {
    opacity: 0.5,
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
  },
  noFormsText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    gap: 10,
  },
  warningText: {
    color: '#f4511e',
    flex: 1,
    fontSize: 14,
  },
  activeVisitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    gap: 10,
  },
  activeVisitText: {
    color: '#4CAF50',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  responseCard: {
    marginBottom: 12,
    borderRadius: 8,
  },
  responseHeader: {
    marginBottom: 8,
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  responseDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  responseUser: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  responseItem: {
    marginVertical: 4,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  responseValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  webMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
});