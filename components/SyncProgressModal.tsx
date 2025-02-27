import React from 'react';
import { Modal, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';

interface SyncProgressModalProps {
  visible: boolean;
  status: {
    type: 'initializing' | 'downloading' | 'uploading' | 'complete' | 'error';
    message: string;
    progress?: number;
  };
  onCancel?: () => void;
  onClose?: () => void;
}

export function SyncProgressModal({ visible, status, onCancel, onClose }: SyncProgressModalProps) {
  const showCancelButton = status.type !== 'complete' && status.type !== 'error' && onCancel;
  const showCloseButton = (status.type === 'complete' || status.type === 'error') && onClose;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            {status.type === 'error' ? (
              <Ionicons name="warning" size={32} color="#F44336" />
            ) : status.type === 'complete' ? (
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            ) : (
              <Ionicons name="sync" size={32} color="#f4511e" />
            )}
            <Text h4 style={styles.title}>
              {status.type === 'initializing' && 'Initializing...'}
              {status.type === 'downloading' && 'Downloading Data...'}
              {status.type === 'uploading' && 'Uploading Changes...'}
              {status.type === 'complete' && 'Sync Complete'}
              {status.type === 'error' && 'Sync Error'}
            </Text>
          </View>

          {status.type !== 'complete' && status.type !== 'error' && (
            <ActivityIndicator size="large" color="#f4511e" style={styles.spinner} />
          )}

          <Text style={styles.message}>{status.message}</Text>

          {status.progress !== undefined && (
            <Text style={styles.progress}>
              {Math.round(status.progress * 100)}% Complete
            </Text>
          )}

          <View style={styles.buttonContainer}>
            {showCancelButton && (
              <Button
                title="Cancel"
                type="outline"
                onPress={onCancel}
                containerStyle={styles.button}
              />
            )}
            {showCloseButton && (
              <Button
                title="Close"
                onPress={onClose}
                containerStyle={styles.button}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  title: {
    color: '#333',
    marginBottom: 0,
  },
  spinner: {
    marginVertical: 20,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  progress: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  button: {
    minWidth: 120,
  },
});