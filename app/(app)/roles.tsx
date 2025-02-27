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
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  type Role,
} from '../../utils/database/roles';
import { Ionicons } from '@expo/vector-icons';

export default function RolesScreen() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const fetchedRoles = await getRoles();
      setRoles(fetchedRoles);
    } catch (error) {
      Alert.alert('Error', 'Failed to load roles');
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      Alert.alert('Error', 'Role name cannot be empty');
      return;
    }

    try {
      await createRole(newRoleName);
      setNewRoleName('');
      loadRoles();
    } catch (error) {
      Alert.alert('Error', 'Failed to create role');
    }
  };

  const handleUpdateRole = async (role: Role) => {
    if (!editingRole?.name.trim()) {
      Alert.alert('Error', 'Role name cannot be empty');
      return;
    }

    try {
      await updateRole(role.id, editingRole.name);
      setEditingRole(null);
      loadRoles();
    } catch (error) {
      Alert.alert('Error', 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      await deleteRole(roleId);
      loadRoles();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete role');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Roles Management</Text>
      </View>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newRoleName}
          onChangeText={setNewRoleName}
          placeholder="Enter new role name"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleCreateRole}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.rolesList}>
        {roles.map((role) => (
          <View key={role.id} style={styles.roleItem}>
            {editingRole?.id === role.id ? (
              <TextInput
                style={styles.editInput}
                value={editingRole.name}
                onChangeText={(text) => setEditingRole({ ...editingRole, name: text })}
                autoFocus
              />
            ) : (
              <Text style={styles.roleName}>{role.name}</Text>
            )}
            
            <View style={styles.actionButtons}>
              {editingRole?.id === role.id ? (
                <>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleUpdateRole(role)}
                  >
                    <Ionicons name="checkmark" size={24} color="green" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => setEditingRole(null)}
                  >
                    <Ionicons name="close" size={24} color="red" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => setEditingRole(role)}
                  >
                    <Ionicons name="create" size={24} color="blue" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDeleteRole(role.id)}
                  >
                    <Ionicons name="trash" size={24} color="red" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Logged in as: {user?.email}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rolesList: {
    flex: 1,
  },
  roleItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 8,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
  },
  footer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});