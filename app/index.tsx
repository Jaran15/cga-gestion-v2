import { View, StyleSheet, Text, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Button, Input, Card } from '@rneui/themed';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuth();

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f4511e" />
      </View>
    );
  }

  const handleLogin = async () => {
    try {
      await login(username, password);
    } catch (error) {
      // Error is handled by the useEffect above
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Card containerStyle={styles.loginBox}>
        <Card.Title style={styles.title}>Login</Card.Title>
        <Card.Divider />
        
        <View style={styles.credentialsInfo}>
          <Text style={styles.credentialsTitle}>Available Credentials:</Text>
          <Text style={styles.credentials}>Admin: admin / admin123</Text>
          <Text style={styles.credentials}>User: usuario1 / user123</Text>
          <Text style={styles.credentials}>Controller: controlador1 / ctrl123</Text>
        </View>

        <Input
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon={{ type: 'ionicon', name: 'person-outline' }}
          onSubmitEditing={handleLogin}
        />
        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon={{ type: 'ionicon', name: 'lock-closed-outline' }}
          onSubmitEditing={handleLogin}
        />
        <Button
          title="Login"
          onPress={handleLogin}
          raised
          loading={isLoading}
          disabled={isLoading}
          containerStyle={styles.buttonContainer}
        />
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loginBox: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 10,
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
  },
  credentialsInfo: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
  },
  credentialsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#666',
  },
  credentials: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  buttonContainer: {
    marginTop: 10,
  },
});