import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRoles,
  getCompanies,
  assignUserRole,
  assignUserCompany,
  type User,
  type Role,
  type Company,
} from '../../utils/database';

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [fetchedUsers, fetchedRoles, fetchedCompanies] = await Promise.all([
        getUsers(),
        getRoles(),
        getCompanies(),
      ]);
      setUsers(fetchedUsers);
      setRoles(fetchedRoles);
      setCompanies(fetchedCompanies);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const handleCreateUser = async () => {
    if (!username.trim() || (!editingUser && !password.trim())) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }

    try {
      setIsLoading(true);
      
      // Create user first
      const userId = await createUser(username, password, isAdmin, isActive);
      
      // Assign roles one by one
      for (const roleId of selectedRoles) {
        try {
          await assignUserRole(userId, roleId);
        } catch (error) {
          console.error(`Failed to assign role ${roleId}:`, error);
        }
      }

      // Assign companies one by one
      for (const companyId of selectedCompanies) {
        try {
          await assignUserCompany(userId, companyId);
        } catch (error) {
          console.error(`Failed to assign company ${companyId}:`, error);
        }
      }

      resetForm();
      await loadData();
      setModalVisible(false);
      Alert.alert('Success', 'User created successfully');
    } catch (error) {
      console.error('Error creating user:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    try {
      setIsLoading(true);
      await updateUser(
        editingUser.id,
        username,
        password, // This will be undefined if not changed
        isAdmin,
        selectedRoles,
        selectedCompanies,
        isActive
      );
      resetForm();
      await loadData();
      setModalVisible(false);
      Alert.alert('Success', 'User updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await deleteUser(id);
              await loadData();
              Alert.alert('Success', 'User deleted successfully');
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert(
                'Error',
                'Failed to delete user. Make sure the user is not referenced in any visits or forms.'
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setIsAdmin(false);
    setIsActive(true);
    setSelectedRoles([]);
    setSelectedCompanies([]);
    setEditingUser(null);
  };

  const openAddUserModal = () => {
    resetForm();
    setModalVisible(true);
  };

  if (!user?.isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.unauthorizedText}>
          You don't have permission to access this page.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Users</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={openAddUserModal}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add User</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.listContainer}>
        {users.map((user) => (
          <View key={user.id} style={styles.userItem}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={styles.userName}>{user.username}</Text>
                <View style={[
                  styles.statusBadge,
                  user.active ? styles.statusActive : styles.statusInactive
                ]}>
                  <Text style={styles.statusText}>
                    {user.active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <Text style={styles.userRole}>
                Admin: {user.isAdmin ? 'Yes' : 'No'}
              </Text>
              {user.roles && user.roles.length > 0 && (
                <Text style={styles.userDetail}>
                  Roles: {user.roles.map(r => r.name).join(', ')}
                </Text>
              )}
              {user.companies && user.companies.length > 0 && (
                <Text style={styles.userDetail}>
                  Companies: {user.companies.map(c => c.name).join(', ')}
                </Text>
              )}
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={() => {
                  setEditingUser(user);
                  setUsername(user.username);
                  setIsAdmin(user.isAdmin);
                  setIsActive(user.active);
                  setSelectedRoles(user.roles?.map(r => r.id) || []);
                  setSelectedCompanies(user.companies?.map(c => c.id) || []);
                  setModalVisible(true);
                }}
                style={styles.iconButton}
                disabled={isLoading}
              >
                <Ionicons name="pencil" size={20} color="#4CAF50" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteUser(user.id)}
                style={styles.iconButton}
                disabled={isLoading}
              >
                <Ionicons name="trash" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingUser ? 'Edit User' : 'Add New User'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollContent}>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
              {!editingUser && (
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
              )}

              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Admin Access</Text>
                <Switch
                  value={isAdmin}
                  onValueChange={setIsAdmin}
                  trackColor={{ false: '#767577', true: '#f4511e' }}
                  thumbColor={isAdmin ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Active Status</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#767577', true: '#4CAF50' }}
                  thumbColor={isActive ? '#fff' : '#f4f3f4'}
                />
              </View>

              <Text style={styles.sectionTitle}>Assign Roles</Text>
              <ScrollView horizontal style={styles.chipContainer}>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role.id}
                    style={[
                      styles.chip,
                      selectedRoles.includes(role.id) && styles.chipSelected,
                    ]}
                    onPress={() => {
                      setSelectedRoles((prev) =>
                        prev.includes(role.id)
                          ? prev.filter((id) => id !== role.id)
                          : [...prev, role.id]
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedRoles.includes(role.id) && styles.chipTextSelected,
                      ]}
                    >
                      {role.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionTitle}>Assign Companies</Text>
              <ScrollView horizontal style={styles.chipContainer}>
                {companies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={[
                      styles.chip,
                      selectedCompanies.includes(company.id) && styles.chipSelected,
                    ]}
                    onPress={() => {
                      setSelectedCompanies((prev) =>
                        prev.includes(company.id)
                          ? prev.filter((id) => id !== company.id)
                          : [...prev, company.id]
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedCompanies.includes(company.id) &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {company.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={editingUser ? handleUpdateUser : handleCreateUser}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>
                  {editingUser ? 'Update User' : 'Add User'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Logged in as: {user.username}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4511e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
    padding: 20,
  },
  userItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userInfo: {
    flex: 1,
    marginRight: 10,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#4CAF5020',
  },
  statusInactive: {
    backgroundColor: '#F4433620',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  userDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScrollContent: {
    maxHeight: '100%',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  chip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#f4511e',
    borderColor: '#f4511e',
  },
  chipText: {
    color: '#666',
  },
  chipTextSelected: {
    color: '#fff',
  },
  button: {
    backgroundColor: '#f4511e',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    textAlign: 'center',
    color: '#666',
  },
  unauthorizedText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
});