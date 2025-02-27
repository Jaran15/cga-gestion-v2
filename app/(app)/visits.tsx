import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView, Platform, Modal, TouchableOpacity } from 'react-native';
import { Button, Text, Card, ListItem, Icon } from '@rneui/themed';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import {
  getActiveVisit,
  startVisit,
  endVisit,
} from '../../utils/database/visits';
import { getUserCompanies } from '../../utils/database/companies';
import { getForms } from '../../utils/database/forms';
import { type Company, type Visit } from '../../utils/database/types';
import * as Location from 'expo-location';

export default function VisitsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadCompanies();
      checkActiveVisit();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    if (activeVisit) {
      loadAvailableForms();
      startTimeRef.current = new Date(activeVisit.start_time).getTime();
      updateElapsedTime();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(updateElapsedTime, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      startTimeRef.current = null;
      setElapsedTime('00:00:00');
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeVisit]);

  const loadCompanies = async () => {
    if (!user) return;
    try {
      const userCompanies = await getUserCompanies(user.id);
      setCompanies(userCompanies);
    } catch (error) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'Failed to load companies');
    }
  };

  const loadAvailableForms = async () => {
    if (!activeVisit || !user) return;
    try {
      const forms = await getForms(user.id);
      setAvailableForms(forms);
      
      if (forms.length > 0) {
        router.push('/(app)/forms');
      }
    } catch (error) {
      console.error('Error loading forms:', error);
    }
  };

  const checkActiveVisit = async () => {
    if (!user) return;
    try {
      const visit = await getActiveVisit(user.id);
      if (visit) {
        setActiveVisit(visit);
        const company = companies.find(c => c.id === visit.company_id);
        if (company) {
          setSelectedCompany(company);
        }
      }
    } catch (error) {
      console.error('Error checking active visit:', error);
    }
  };

  const updateElapsedTime = useCallback(() => {
    if (startTimeRef.current) {
      const now = Date.now();
      const diff = Math.max(0, now - startTimeRef.current);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }
  }, []);

  const handleLocationSelection = async (isOffice: boolean) => {
    if (!user || !selectedCompany) return;
    
    setIsLoading(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      let noGpsSignal = false;

      if (isOffice) {
        // For office visits, set noGpsSignal to true and coordinates to null
        noGpsSignal = true;
        latitude = null;
        longitude = null;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Location permission is required for outside visits.');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
        noGpsSignal = false;
      }

      // Get the first role ID (assuming user has at least one role)
      const roleId = user.roles?.[0]?.id;
      if (!roleId) {
        Alert.alert('Error', 'User role not found');
        return;
      }

      await startVisit(
        user.id,
        selectedCompany.id,
        roleId,
        latitude,
        longitude,
        noGpsSignal
      );

      const visit = await getActiveVisit(user.id);
      if (visit) {
        setActiveVisit(visit);
        startTimeRef.current = new Date(visit.start_time).getTime();
        updateElapsedTime();
      }

      setShowLocationModal(false);
    } catch (error) {
      console.error('Error starting visit:', error);
      Alert.alert('Error', 'Failed to start visit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartVisit = () => {
    if (!selectedCompany) {
      setShowCompanyModal(true);
      return;
    }
    setShowLocationModal(true);
  };

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    setShowCompanyModal(false);
    setShowLocationModal(true);
  };

  const handleEndVisit = async () => {
    if (!activeVisit) return;

    setIsLoading(true);
    try {
      let endLatitude: number | null = null;
      let endLongitude: number | null = null;
      let noGpsSignalEnd = true;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          endLatitude = location.coords.latitude;
          endLongitude = location.coords.longitude;
          noGpsSignalEnd = false;
        }
      } catch (error) {
        console.log('Could not get end location:', error);
      }

      await endVisit(
        activeVisit.id,
        endLatitude,
        endLongitude,
        noGpsSignalEnd
      );
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      startTimeRef.current = null;
      setActiveVisit(null);
      setSelectedCompany(null);
      setElapsedTime('00:00:00');
    } catch (error) {
      Alert.alert('Error', 'Failed to end visit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormsPress = () => {
    if (activeVisit) {
      router.push('/(app)/forms');
    }
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ScrollView>
        {!activeVisit ? (
          <Card>
            <Card.Title>Start Visit</Card.Title>
            <Card.Divider />
            {selectedCompany ? (
              <View style={styles.selectedCompanyContainer}>
                <Text style={styles.selectedCompanyTitle}>Selected Company:</Text>
                <View style={styles.selectedCompanyInfo}>
                  <Icon name="business" type="ionicon" color="#4CAF50" />
                  <Text style={styles.selectedCompanyName}>{selectedCompany.name}</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedCompany(null)}
                    style={styles.changeButton}
                  >
                    <Text style={styles.changeButtonText}>Change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.selectPrompt}>Please select a company to start your visit</Text>
            )}

            <View style={styles.buttonContainer}>
              <Button
                title={selectedCompany ? "Start Visit" : "Select Company"}
                onPress={handleStartVisit}
                disabled={isLoading}
                loading={isLoading}
                containerStyle={styles.button}
              />
              <Button
                title="Available Forms"
                onPress={handleFormsPress}
                disabled={!activeVisit}
                containerStyle={[styles.button, !activeVisit && styles.disabledButton]}
                type="outline"
              />
            </View>
          </Card>
        ) : (
          <>
            <Card>
              <Card.Title>Active Visit</Card.Title>
              <Card.Divider />
              <Text style={styles.timerText}>{elapsedTime}</Text>
              <Text style={styles.companyName}>
                {companies.find((c) => c.id === activeVisit.company_id)?.name}
              </Text>
              <View style={styles.buttonContainer}>
                <Button
                  title="End Visit"
                  onPress={handleEndVisit}
                  loading={isLoading}
                  disabled={isLoading}
                  containerStyle={styles.button}
                  color="error"
                />
                <Button
                  title="Fill Forms"
                  onPress={handleFormsPress}
                  containerStyle={styles.button}
                  type="outline"
                />
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Company Selection Modal */}
      <Modal
        visible={showCompanyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Company</Text>
            <ScrollView style={styles.companyList}>
              {companies.map((company) => (
                <TouchableOpacity
                  key={company.id}
                  style={styles.companyItem}
                  onPress={() => handleCompanySelect(company)}
                >
                  <Icon name="business" type="ionicon" color="#666" size={24} />
                  <View style={styles.companyItemContent}>
                    <Text style={styles.companyItemName}>{company.name}</Text>
                    {company.description && (
                      <Text style={styles.companyItemDescription}>{company.description}</Text>
                    )}
                  </View>
                  <Icon name="chevron-forward" type="ionicon" color="#666" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Cancel"
              type="clear"
              onPress={() => setShowCompanyModal(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Location Selection Modal */}
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Where are you?</Text>
            <View style={styles.modalButtons}>
              <Button
                title="In the Office"
                icon={{
                  name: 'business',
                  type: 'ionicon',
                  color: 'white',
                }}
                onPress={() => handleLocationSelection(true)}
                loading={isLoading}
                disabled={isLoading}
                containerStyle={styles.modalButton}
              />
              <Button
                title="Outside"
                icon={{
                  name: 'location',
                  type: 'ionicon',
                  color: 'white',
                }}
                onPress={() => handleLocationSelection(false)}
                loading={isLoading}
                disabled={isLoading}
                containerStyle={styles.modalButton}
              />
            </View>
            <Button
              title="Cancel"
              type="clear"
              onPress={() => setShowLocationModal(false)}
              disabled={isLoading}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  buttonContainer: {
    gap: 10,
    marginTop: 20,
  },
  button: {
    width: '100%',
  },
  disabledButton: {
    opacity: 0.5,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  companyName: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    gap: 10,
    marginBottom: 10,
  },
  modalButton: {
    marginVertical: 5,
  },
  selectedCompanyContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  selectedCompanyTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  selectedCompanyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedCompanyName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  changeButton: {
    padding: 8,
  },
  changeButtonText: {
    color: '#f4511e',
    fontSize: 14,
  },
  selectPrompt: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginBottom: 20,
  },
  companyList: {
    maxHeight: 400,
  },
  companyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 10,
  },
  companyItemContent: {
    flex: 1,
  },
  companyItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  companyItemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});