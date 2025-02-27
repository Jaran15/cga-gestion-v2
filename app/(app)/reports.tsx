import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { Card, Text, Button, ListItem, Icon, Divider } from '@rneui/themed';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCompanies, getVisitReports, type Company, type VisitReport } from '../../utils/database';
import { useRouter } from 'expo-router';

export default function ReportsScreen() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reports, setReports] = useState<VisitReport[]>([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    loadReports();
  }, [selectedCompany, startDate, endDate]);

  const loadCompanies = async () => {
    try {
      const fetchedCompanies = await getCompanies();
      setCompanies(fetchedCompanies);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadReports = async () => {
    try {
      const reports = await getVisitReports(
        selectedCompany?.id || null,
        startDate.toISOString(),
        endDate.toISOString()
      );
      setReports(reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatCoordinates = (lat: number, lon: number) => {
    return `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
  };

  const openLocation = (latitude: number, longitude: number, mapType: 'native' | 'osm') => {
    let url: string;
    
    if (mapType === 'osm') {
      url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=15`;
    } else {
      url = Platform.select({
        ios: `maps:${latitude},${longitude}`,
        android: `geo:${latitude},${longitude}`,
        web: `https://www.google.com/maps?q=${latitude},${longitude}`
      }) || '';
    }

    Linking.openURL(url);
  };

  const renderLocationInfo = (visit: VisitReport['visits'][0], type: 'start' | 'end') => {
    const isStart = type === 'start';
    const noGpsSignal = isStart ? visit.no_gps_signal_start : visit.no_gps_signal_end;
    const latitude = isStart ? visit.start_latitude : visit.end_latitude;
    const longitude = isStart ? visit.start_longitude : visit.end_longitude;

    if (noGpsSignal) {
      return (
        <View style={styles.locationInfo}>
          <Icon
            name="business"
            type="ionicon"
            size={16}
            color="#4CAF50"
          />
          <Text style={styles.officeText}>In Office</Text>
        </View>
      );
    }

    if (latitude && longitude) {
      return (
        <View style={styles.locationInfo}>
          <Icon
            name="location"
            type="ionicon"
            size={16}
            color="#2196F3"
          />
          <Text style={styles.coordinates}>
            {formatCoordinates(latitude, longitude)}
          </Text>
          <View style={styles.mapButtons}>
            <Button
              title="Maps"
              type="clear"
              icon={{
                name: 'map-outline',
                type: 'ionicon',
                size: 16,
                color: '#f4511e',
              }}
              titleStyle={{ color: '#f4511e', fontSize: 14 }}
              onPress={() => openLocation(latitude, longitude, 'native')}
            />
            <Button
              title="OpenStreetMap"
              type="clear"
              icon={{
                name: 'location-outline',
                type: 'ionicon',
                size: 16,
                color: '#f4511e',
              }}
              titleStyle={{ color: '#f4511e', fontSize: 14 }}
              onPress={() => openLocation(latitude, longitude, 'osm')}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.locationInfo}>
        <Icon
          name="help-circle-outline"
          type="ionicon"
          size={16}
          color="#666"
        />
        <Text style={styles.noLocationText}>Location not available</Text>
      </View>
    );
  };

  const handleViewVisitForms = (visit: VisitReport['visits'][0]) => {
    if (!visit || !visit.id) {
      console.error('Invalid visit data:', visit);
      return;
    }
    console.log('Navigating to visit forms with ID:', visit.id);
    router.push(`/visits/${visit.id}/forms`);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Reports</Card.Title>
          <Card.Divider />
          <Text style={styles.webMessage}>
            Reports are only available in the mobile app.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        <Card>
          <Card.Title>Visit Reports</Card.Title>
          <Card.Divider />

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Date Range</Text>
            <View style={styles.dateContainer}>
              <Button
                title={startDate.toLocaleDateString()}
                onPress={() => setShowStartPicker(true)}
                type="outline"
                containerStyle={styles.dateButton}
              />
              <Text>to</Text>
              <Button
                title={endDate.toLocaleDateString()}
                onPress={() => setShowEndPicker(true)}
                type="outline"
                containerStyle={styles.dateButton}
              />
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (date) setStartDate(date);
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (date) setEndDate(date);
                }}
              />
            )}

            <Text style={[styles.filterTitle, { marginTop: 20 }]}>Company Filter</Text>
            <ScrollView horizontal style={styles.companyScroll}>
              <Button
                title="All Companies"
                type={selectedCompany === null ? 'solid' : 'outline'}
                onPress={() => setSelectedCompany(null)}
                containerStyle={styles.companyButton}
              />
              {companies.map((company) => (
                <Button
                  key={company.id}
                  title={company.name}
                  type={selectedCompany?.id === company.id ? 'solid' : 'outline'}
                  onPress={() => setSelectedCompany(company)}
                  containerStyle={styles.companyButton}
                />
              ))}
            </ScrollView>
          </View>
        </Card>

        {reports.map((report) => (
          <Card key={`${report.user_id}-${report.company_id}`}>
            <ListItem>
              <Icon name="person-outline" type="ionicon" />
              <ListItem.Content>
                <ListItem.Title>{report.username}</ListItem.Title>
                <ListItem.Subtitle>{report.company_name}</ListItem.Subtitle>
              </ListItem.Content>
              <Text style={styles.totalDuration}>
                Total: {formatDuration(report.total_duration)}
              </Text>
            </ListItem>
            
            <Divider style={{ marginVertical: 10 }} />
            
            <View style={styles.visitsContainer}>
              {report.visits.map((visit, index) => (
                <View key={index}>
                  <View style={styles.visitItem}>
                    <View style={styles.visitInfo}>
                      <Text style={styles.visitTime}>
                        {formatDateTime(visit.start_time)} - {formatDateTime(visit.end_time)}
                      </Text>
                      <Text style={styles.visitDuration}>
                        Duration: {formatDuration(visit.duration)}
                      </Text>
                      <View style={styles.locationContainer}>
                        <View style={styles.locationSection}>
                          <Text style={styles.locationLabel}>Start Location:</Text>
                          {renderLocationInfo(visit, 'start')}
                        </View>
                        <View style={styles.locationSection}>
                          <Text style={styles.locationLabel}>End Location:</Text>
                          {renderLocationInfo(visit, 'end')}
                        </View>
                      </View>
                      <Button
                        title="View Forms"
                        type="outline"
                        icon={{
                          name: 'document-text-outline',
                          type: 'ionicon',
                          size: 16,
                          color: '#f4511e',
                        }}
                        onPress={() => handleViewVisitForms(visit)}
                        containerStyle={styles.viewFormsButton}
                      />
                    </View>
                  </View>
                  {index < report.visits.length - 1 && (
                    <Divider style={{ marginVertical: 5 }} />
                  )}
                </View>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterSection: {
    padding: 10,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateButton: {
    width: '45%',
  },
  companyScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  companyButton: {
    marginRight: 10,
  },
  totalDuration: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f4511e',
  },
  visitsContainer: {
    marginTop: 10,
  },
  visitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  visitInfo: {
    flex: 1,
  },
  visitTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitDuration: {
    fontSize: 14,
    color: '#f4511e',
    fontWeight: '500',
    marginBottom: 8,
  },
  locationContainer: {
    marginTop: 4,
  },
  locationSection: {
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    paddingVertical: 2,
  },
  officeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 6,
  },
  noLocationText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 6,
  },
  coordinates: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 6,
    fontWeight: '500',
  },
  mapButtons: {
    flexDirection: 'row',
    marginTop: 4,
    marginLeft: -8,
  },
  webMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  viewFormsButton: {
    marginTop: 10,
  },
});