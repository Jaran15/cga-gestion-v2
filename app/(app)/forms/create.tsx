import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, Card, ListItem, Icon, Switch, ButtonGroup } from '@rneui/themed';
import { useAuth } from '../../../context/AuthContext';
import { createForm } from '../../../utils/database/forms';
import { getCompanies, type Company } from '../../../utils/database/companies';
import { Ionicons } from '@expo/vector-icons';

type FieldType = 'text' | 'number' | 'date' | 'boolean';

interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  sort_order: number;
}

export default function CreateFormScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) {
      Alert.alert('Unauthorized', 'You do not have permission to create forms.');
      router.back();
      return;
    }
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const fetchedCompanies = await getCompanies();
      setCompanies(fetchedCompanies);
    } catch (error) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'Failed to load companies');
    }
  };

  const addField = () => {
    setFields([
      ...fields,
      {
        name: '',
        label: '',
        type: 'text',
        required: false,
        sort_order: fields.length,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], ...updates };
    setFields(updatedFields);
  };

  const removeField = (index: number) => {
    const updatedFields = fields.filter((_, i) => i !== index);
    // Update sort_order for remaining fields
    setFields(
      updatedFields.map((field, i) => ({
        ...field,
        sort_order: i,
      }))
    );
  };

  const handleCreateForm = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Form name is required');
      return;
    }

    if (fields.length === 0) {
      Alert.alert('Error', 'At least one field is required');
      return;
    }

    if (selectedCompanies.length === 0) {
      Alert.alert('Error', 'Please select at least one company');
      return;
    }

    // Validate fields
    for (const field of fields) {
      if (!field.name.trim() || !field.label.trim()) {
        Alert.alert('Error', 'All fields must have a name and label');
        return;
      }
    }

    try {
      setIsLoading(true);
      await createForm(formName, formDescription, fields, selectedCompanies);
      Alert.alert('Success', 'Form created successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error creating form:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create form');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFieldTypeButtons = (index: number, currentType: FieldType) => {
    const types: FieldType[] = ['text', 'number', 'date', 'boolean'];
    const icons = {
      text: 'text-outline',
      number: 'calculator-outline',
      date: 'calendar-outline',
      boolean: 'toggle-outline'
    };
    
    return (
      <ButtonGroup
        buttons={types.map(type => ({
          element: () => (
            <View style={styles.typeButton}>
              <Ionicons
                name={icons[type]}
                size={20}
                color={currentType === type ? '#fff' : '#f4511e'}
              />
              <Text style={[
                styles.typeButtonText,
                currentType === type && styles.typeButtonTextSelected
              ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </View>
          )
        }))}
        selectedIndex={types.indexOf(currentType)}
        onPress={(selectedIndex) => {
          updateField(index, { type: types[selectedIndex] });
        }}
        containerStyle={styles.typeButtonGroup}
        selectedButtonStyle={styles.typeButtonSelected}
      />
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Card>
        <Card.Title>Create New Form</Card.Title>
        <Card.Divider />
        
        <View style={styles.section}>
          <Text style={styles.label}>Form Name *</Text>
          <TextInput
            style={styles.input}
            value={formName}
            onChangeText={setFormName}
            placeholder="Enter form name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formDescription}
            onChangeText={setFormDescription}
            placeholder="Enter form description"
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Fields</Text>
          {fields.map((field, index) => (
            <View key={index} style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldTitle}>Field {index + 1}</Text>
                <TouchableOpacity
                  onPress={() => removeField(index)}
                  style={styles.removeButton}
                >
                  <Ionicons name="trash-outline" type="ionicon" color="#F44336" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={field.name}
                onChangeText={(text) => updateField(index, { name: text })}
                placeholder="Field name (e.g., firstName)"
                placeholderTextColor="#666"
              />

              <TextInput
                style={styles.input}
                value={field.label}
                onChangeText={(text) => updateField(index, { label: text })}
                placeholder="Field label (e.g., First Name)"
                placeholderTextColor="#666"
              />

              <View style={styles.fieldOptions}>
                <Text style={styles.typeLabel}>Field Type:</Text>
                {renderFieldTypeButtons(index, field.type)}

                <View style={styles.requiredToggle}>
                  <Text>Required:</Text>
                  <Switch
                    value={field.required}
                    onValueChange={(value) =>
                      updateField(index, { required: value })
                    }
                  />
                </View>
              </View>
            </View>
          ))}

          <Button
            title="Add Field"
            type="outline"
            onPress={addField}
            icon={{
              name: 'add-circle-outline',
              type: 'ionicon',
              color: '#f4511e',
            }}
            containerStyle={styles.addFieldButton}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Assign to Companies</Text>
          {companies.map((company) => (
            <ListItem key={company.id} bottomDivider>
              <ListItem.CheckBox
                checked={selectedCompanies.includes(company.id)}
                onPress={() => {
                  setSelectedCompanies((prev) =>
                    prev.includes(company.id)
                      ? prev.filter((id) => id !== company.id)
                      : [...prev, company.id]
                  );
                }}
              />
              <ListItem.Content>
                <ListItem.Title>{company.name}</ListItem.Title>
                <ListItem.Subtitle>{company.description}</ListItem.Subtitle>
              </ListItem.Content>
            </ListItem>
          ))}
        </View>

        <Button
          title="Create Form"
          onPress={handleCreateForm}
          loading={isLoading}
          disabled={isLoading}
          containerStyle={styles.submitButton}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  fieldContainer: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 4,
    marginBottom: 10,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fieldTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  removeButton: {
    padding: 5,
  },
  fieldOptions: {
    marginTop: 10,
    gap: 10,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 5,
  },
  typeButtonGroup: {
    marginBottom: 10,
    height: 40,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  typeButtonText: {
    fontSize: 12,
    color: '#f4511e',
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  typeButtonSelected: {
    backgroundColor: '#f4511e',
  },
  requiredToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  addFieldButton: {
    marginTop: 10,
  },
  submitButton: {
    marginTop: 20,
  },
});