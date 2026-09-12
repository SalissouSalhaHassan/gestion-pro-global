
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:io';

void main() async {
  final client = SupabaseClient(
    'https://ktunkjugqpebsdrvorka.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dW5ranVncXBlYnNkcnZvcmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjYzMzUsImV4cCI6MjA5MTkwMjMzNX0.wrYZU8XCCwUSxxyidbrQXPxVNaDNNWc5gfR1ZPMljYc'
  );

  try {
    final res = await client.from('activity_logs').select().limit(1).maybeSingle();
    print('Sample log: $res');
  } catch (e) {
    print('Error: $e');
  }
  exit(0);
}
