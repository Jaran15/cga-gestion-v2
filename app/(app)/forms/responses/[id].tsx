import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, ListItem, Button, Icon, Divider } from '@rneui/themed';
import { useAuth } from '../../../../context/AuthContext';
import {
  getFormResponses,
  getFormById,
  type Form,
} from '../../../../utils/database/forms';

export default function FormResponsesScreen() {
  const { formId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFormAndResponses() {
      try {
        const formData = await getFormById(formId as string);
        setForm(formData);
        const responsesData = await getFormResponses(formId as string);
        setResponses(responsesData);
      } catch (error) {
        console.error('Error fetching form and responses:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFormAndResponses();
  }, [formId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!form) {
    return (
      <View style={styles.container}>
        <Text>Form not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card>
        <Card.Title>{form.title}</Card.Title>
        <Card.Divider />
        <Text style={styles.description}>{form.description}</Text>
      </Card>

      <Card containerStyle={styles.responsesCard}>
        <Card.Title>Responses ({responses.length})</Card.Title>
        <Card.Divider />
        {responses.map((response, index) => (
          <View key={response.id}>
            <ListItem
              onPress={() => router.push(`/forms/${formId}/responses/${response.id}`)}
            >
              <ListItem.Content>
                <ListItem.Title>Response #{index + 1}</ListItem.Title>
                <ListItem.Subtitle>
                  Submitted: {new Date(response.createdAt).toLocaleDateString()}
                </ListItem.Subtitle>
              </ListItem.Content>
              <ListItem.Chevron />
            </ListItem>
            {index < responses.length - 1 && <Divider />}
          </View>
        ))}
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
    fontSize: 16,
    color: '#666',
  },
  responsesCard: {
    marginTop: 15,
  },
});