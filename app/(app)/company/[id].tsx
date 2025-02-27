import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, Text, ListItem, Icon, Divider } from '@rneui/themed';
import { useAuth } from '../../../context/AuthContext';
import { getVisitReports, type VisitReport } from '../../../utils/database';

export default function CompanyVisitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [reports, setReports] = useState<VisitReport[]>([]);
  const [companyName, setCompanyName] = useState<string>('');

  useEffect(() => {
    if (user && id) {
      loadReports();
      // Find company name from user's companies
      const company = user.companies?.find(c => c.id === parseInt(id));
      if (company) {
        setCompanyName(company.name);
      }
    }
  }, [id, user]);

  const loadReports = async () => {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1); // Last 30 days
      const endDate = new Date();

      const reports = await getVisitReports(
        parseInt(id),
        startDate.toISOString(),
        endDate.toISOString(),
        user?.isAdmin ? null : user?.id
      );
      setReports(reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Title>Company Visits</Card.Title>
          <Card.Divider />
          <Text style={styles.webMessage}>
            Company visits are only available in the mobile app.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        <Card>
          <Card.Title>{companyName} - Visit Reports</Card.Title>
          <Card.Divider />
          
          {reports.length === 0 ? (
            <Text style={styles.noDataText}>No visits found for this company.</Text>
          ) : (
            reports.map((report) => (
              <View key={`${report.userId}-${report.companyId}`} style={styles.reportContainer}>
                <ListItem>
                  <Icon name="person-outline" type="ionicon" />
                  <ListItem.Content>
                    <ListItem.Title>{report.username}</ListItem.Title>
                    <ListItem.Subtitle>
                      Total Duration: {formatDuration(report.totalDuration)}
                    </ListItem.Subtitle>
                  </ListItem.Content>
                </ListItem>
                
                <Divider style={styles.divider} />
                
                {report.visits.map((visit, index) => (
                  <View key={index} style={styles.visitItem}>
                    <Text style={styles.visitTime}>
                      {formatDateTime(visit.startTime)} - {formatDateTime(visit.endTime)}
                    </Text>
                    <Text style={styles.duration}>
                      Duration: {formatDuration(visit.duration)}
                    </Text>
                    {visit.noGpsSignalStart ? (
                      <View style={styles.locationInfo}>
                        <Icon name="business" type="ionicon" size={16} color="#4CAF50" />
                        <Text style={styles.inOfficeText}>Started in office</Text>
                      </View>
                    ) : null}
                    {visit.noGpsSignalEnd ? (
                      <View style={styles.locationInfo}>
                        <Icon name="business" type="ionicon" size={16} color="#4CAF50" />
                        <Text style={styles.inOfficeText}>Ended in office</Text>
                      </View>
                    ) : null}
                    {index < report.visits.length - 1 && <Divider style={styles.visitDivider} />}
                  </View>
                ))}
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  webMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  reportContainer: {
    marginBottom: 20,
  },
  divider: {
    marginVertical: 10,
  },
  visitItem: {
    padding: 10,
  },
  visitTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  duration: {
    fontSize: 14,
    color: '#f4511e',
    fontWeight: '500',
    marginBottom: 5,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  inOfficeText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 8,
  },
  visitDivider: {
    marginVertical: 8,
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    padding: 20,
  },
});