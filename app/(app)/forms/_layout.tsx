import { Stack } from 'expo-router';

export default function FormsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Forms',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Form Details',
          presentation: 'modal'
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          title: 'Create Form',
          presentation: 'modal'
        }}
      />
      <Stack.Screen
        name="responses/[id]"
        options={{
          title: 'Form Responses'
        }}
      />
    </Stack>
  );
}