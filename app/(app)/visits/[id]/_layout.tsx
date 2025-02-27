import { Stack } from 'expo-router';

export default function VisitLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="forms"
        options={{
          title: 'Form Responses',
          presentation: 'card'
        }}
      />
    </Stack>
  );
}