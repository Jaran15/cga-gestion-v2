import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, Icon, Divider, Button } from '@rneui/themed';
import { getFormResponses } from '../../../../utils/database/forms';

interface FormResponse {
  id: number;
  formName: string;
  username: string;
  created_at: string;
  responses: {
    fieldLabel: string;
    value: string;
  }[];
}

interface GroupedResponses {
  [date: string]: FormResponse[];
}

export default function VisitFormResponsesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [responses, setResponses] = useState<GroupedResponses>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResponses();
  }, [id]);

  const loadResponses = async () => {
    try {
      console.log('Loading responses for visit ID:', id);
      if (!id) {
        throw new Error('No visit ID provided');
      }
      
      const visitId = parseInt(id as string);
      if (isNaN(visitId)) {
        throw new Error('Invalid visit ID');
      }

      const formResponses = await getFormResponses(null, visitId);
      console.log('Loaded form responses:', formResponses);

      // Group responses by date
      const grouped = formResponses.reduce((acc: GroupedResponses, response) => {
        const date = new Date(response.created_at).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(response);
        return acc;
      }, {});

      setResponses(grouped);
      setError(null);
    } catch (error) {
      console.error('Error loading form responses:', error);
      setError(error instanceof Error ? error.message : 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Form Responses</Card.Title>
          <Card.Divider />
          <Text style={styles.webMessage}>
            Form responses are only available in the mobile app.
          </Text>
        </Card>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Loading Responses...</Card.Title>
          <Text style={styles.loadingText}>Please wait while we load the form responses...</Text>
        </Card>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Error</Card.Title>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      </View>
    );
  }

  if (Object.keys(responses).length === 0) {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>No Forms Found</Card.Title>
          <View style={styles.emptyContainer}>
            <Icon name="document-text-outline" type="ionicon" size={48} color="#666" />
            <Text style={styles.emptyText}>No form responses found for this visit</Text>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {Object.entries(responses).map(([date, dateResponses]) => (
        <Card key={date} containerStyle={styles.dateCard}>
          <View style={styles.dateHeader}>
            <Icon name="calendar-outline" type="ionicon" size={24} color="#f4511e" />
            <Text style={styles.dateTitle}>{date}</Text>
            <Text style={styles.responseCount}>
              {dateResponses.length} form{dateResponses.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <Card.Divider style={styles.dateDivider} />

          {dateResponses.map((response, index) => (
            <View key={response.id} style={styles.formContainer}>
              <View style={styles.formHeader}>
                <View style={styles.formTitleContainer}>
                  <Icon name="document-text" type="ionicon" size={20} color="#f4511e" />
                  <Text style={styles.formTitle}>{response.formName}</Text>
                </View>
                <Text style={styles.formTime}>
                  {formatTime(response.created_at)}
                </Text>
              </View>

              <View style={styles.submittedBy}>
                <Icon name="person-outline" type="ionicon" size={16} color="#666" />
                <Text style={styles.submittedByText}>Submitted by {response.username}</Text>
              </View>

              <View style={styles.responsesContainer}>
                {response.responses.map((field, fieldIndex) => (
                  <View key={fieldIndex} style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>{field.fieldLabel}</Text>
                    <View style={styles.fieldValue}>
                      {field.value === 'true' || field.value === 'false' ? (
                        <View style={styles.booleanValue}>
                          <Icon
                            name={field.value === 'true' ? 'checkmark-circle' : 'close-circle'}
                            type="ionicon"
                            color={field.value === 'true' ? '#4CAF50' : '#F44336'}
                            size={24}
                          />
                          <Text style={[
                            styles.booleanText,
                            { color: field.value === 'true' ? '#4CAF50' : '#F44336' }
                          ]}>
                            {field.value === 'true' ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.fieldText}>{field.value}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {index < dateResponses.length - 1 && (
                <Divider style={styles.formDivider} />
              )}
            </View>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  dateCard: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  responseCount: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  dateDivider: {
    marginBottom: 16,
  },
  formContainer: {
    marginBottom: 16,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  formTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  formTime: {
    fontSize: 14,
    color: '#666',
  },
  submittedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  submittedByText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  responsesContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  fieldValue: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  fieldText: {
    fontSize: 16,
    color: '#333',
  },
  booleanValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  booleanText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  formDivider: {
    marginVertical: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  webMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
});