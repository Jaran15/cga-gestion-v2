import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Text, Card, Input, Switch } from '@rneui/themed';
import { useAuth } from '../../../context/AuthContext';
import {
  getFormById,
  createFormResponse,
  getFormResponses,
  type Form,
  type FormField,
} from '../../../utils/database/forms';
import { getActiveVisit } from '../../../utils/database/visits';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function FormResponseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeField, setActiveField] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    loadForm();
  }, [id]);

  const loadForm = async () => {
    if (!id) {
      setError('No form ID provided');
      setIsLoading(false);
      return;
    }

    try {
      const formData = await getFormById(parseInt(id));
      if (!formData) {
        setError('Form not found');
      } else {
        setForm(formData);
        // Initialize form data with empty values
        const initialData = formData.fields?.reduce((acc, field) => {
          acc[field.id] = '';
          return acc;
        }, {} as Record<string, string>);
        setFormData(initialData || {});

        // Check if user has already submitted this form
        if (user) {
          const visit = await getActiveVisit(user.id);
          if (visit) {
            const responses = await getFormResponses(parseInt(id), visit.id, user.id);
            if (responses.length > 0) {
              setHasSubmitted(true);
              setError('You have already submitted this form');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading form:', error);
      setError('Failed to load form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form || !user) return;
    
    try {
      setIsSubmitting(true);

      const visit = await getActiveVisit(user.id);
      if (!visit) {
        Alert.alert('Error', 'No active visit found');
        return;
      }

      // Check if user has already submitted this form
      const existingResponses = await getFormResponses(form.id, visit.id, user.id);
      if (existingResponses.length > 0) {
        Alert.alert('Error', 'You have already submitted this form');
        return;
      }

      // Validate required fields
      const missingFields = form.fields?.filter(
        field => field.required && !formData[field.id]
      );

      if (missingFields && missingFields.length > 0) {
        Alert.alert(
          'Required Fields',
          `Please fill in the following required fields:\n${missingFields
            .map(f => f.label)
            .join('\n')}`
        );
        return;
      }

      // Format responses
      const responses = Object.entries(formData).map(([fieldId, value]) => ({
        field_id: parseInt(fieldId),
        value: value.toString()
      }));

      await createFormResponse({
        formId: form.id,
        visitId: visit.id,
        userId: user.id,
        responses
      });

      setHasSubmitted(true);
      Alert.alert('Success', 'Form submitted successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Form submission error:', error);
      Alert.alert('Error', 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate && activeField) {
      handleInputChange(activeField, selectedDate.toISOString().split('T')[0]);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Loading Form...</Card.Title>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Please wait while we load the form...</Text>
          </View>
        </Card>
      </View>
    );
  }

  if (error || !form) {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Error</Card.Title>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error || 'Form not found'}</Text>
            <Button
              title="Go Back"
              onPress={() => router.back()}
              containerStyle={styles.errorButton}
            />
          </View>
        </Card>
      </View>
    );
  }

  if (hasSubmitted) {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Form Already Submitted</Card.Title>
          <View style={styles.errorContainer}>
            <Text style={styles.submittedText}>
              You have already submitted this form. Each form can only be submitted once per visit.
            </Text>
            <Button
              title="Go Back"
              onPress={() => router.back()}
              containerStyle={styles.errorButton}
            />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card>
        <Card.Title>{form.name}</Card.Title>
        <Text style={styles.description}>{form.description}</Text>
        <Text style={styles.createdAt}>
          Created: {new Date(form.created_at).toLocaleDateString()}
        </Text>
        
        {form.fields?.map((field: FormField) => (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            {field.type === 'date' ? (
              <View>
                <Button
                  title={formData[field.id] || 'Select Date'}
                  onPress={() => {
                    setActiveField(field.id);
                    setShowDatePicker(true);
                  }}
                />
                {showDatePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={
                      formData[field.id]
                        ? new Date(formData[field.id])
                        : new Date()
                    }
                    mode="date"
                    onChange={handleDateChange}
                  />
                )}
              </View>
            ) : field.type === 'boolean' ? (
              <Switch
                value={formData[field.id] === 'true'}
                onValueChange={(value) => handleInputChange(field.id, value.toString())}
                trackColor={{ false: '#767577', true: '#f4511e' }}
                thumbColor={formData[field.id] === 'true' ? '#fff' : '#f4f3f4'}
              />
            ) : field.type === 'longtext' ? (
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={formData[field.id]}
                onChangeText={(value) => handleInputChange(field.id, value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            ) : (
              <Input
                value={formData[field.id]}
                onChangeText={(value) => handleInputChange(field.id, value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              />
            )}
          </View>
        ))}
        <Button
          title={isSubmitting ? 'Submitting...' : 'Submit'}
          onPress={handleSubmit}
          disabled={isSubmitting || hasSubmitted}
          loading={isSubmitting}
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
  description: {
    marginBottom: 10,
    color: '#666',
  },
  createdAt: {
    fontSize: 12,
    color: '#999',
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  required: {
    color: '#f4511e',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    minHeight: 100,
  },
  submitButton: {
    marginTop: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#f4511e',
    textAlign: 'center',
    marginBottom: 20,
  },
  submittedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    width: 200,
  },
});