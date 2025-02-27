import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  type Company,
} from '../../utils/database/companies';
import { Ionicons } from '@expo/vector-icons';

export default function CompaniesScreen() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const companiesData = await getCompanies();
      setCompanies(companiesData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load companies');
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) return;

    try {
      await createCompany(newCompanyName.trim(), ''); // Empty description for now
      setNewCompanyName('');
      loadCompanies();
    } catch (error) {
      Alert.alert('Error', 'Failed to create company');
    }
  };

  const handleUpdateCompany = async (company: Company) => {
    if (!editingCompany || !editingCompany.name.trim()) return;

    try {
      await updateCompany(company.id, editingCompany.name.trim(), company.description || '');
      setEditingCompany(null);
      loadCompanies();
    } catch (error) {
      Alert.alert('Error', 'Failed to update company');
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    try {
      await deleteCompany(company.id);
      loadCompanies();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete company');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newCompanyName}
          onChangeText={setNewCompanyName}
          placeholder="Enter company name"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleCreateCompany}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer}>
        {companies.map((company) => (
          <View key={company.id} style={styles.companyItem}>
            {editingCompany?.id === company.id ? (
              <TextInput
                style={styles.editInput}
                value={editingCompany.name}
                onChangeText={(text) =>
                  setEditingCompany({ ...editingCompany, name: text })
                }
                autoFocus
              />
            ) : (
              <Text style={styles.companyName}>{company.name}</Text>
            )}
            <View style={styles.actionButtons}>
              {editingCompany?.id === company.id ? (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => handleUpdateCompany(company)}
                >
                  <Ionicons name="checkmark" size={24} color="white" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditingCompany(company)}
                >
                  <Ionicons name="pencil" size={24} color="white" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteCompany(company)}
              >
                <Ionicons name="trash" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
  },
  companyItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  companyName: {
    flex: 1,
    fontSize: 16,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  editButton: {
    width: 40,
    height: 40,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  saveButton: {
    width: 40,
    height: 40,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  deleteButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F44336',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});