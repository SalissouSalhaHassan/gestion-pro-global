import 'package:bcrypt/bcrypt.dart';

void main() {
  // Test bcrypt compatibility with Python-generated hash
  
  // This is the actual hash from Supabase (from screenshot: $2b$12$...)
  // We need to test with a known password
  
  final testPassword = "admin";
  
  // Generate a new hash for testing
  final newHash = BCrypt.hashpw(testPassword, BCrypt.gensalt());
  print("Generated hash: $newHash");
  
  // Test verification
  final matches = BCrypt.checkpw(testPassword, newHash);
  print("Password matches new hash: $matches");
  
  // Test with Python bcrypt format ($2b$)
  // This simulates what we get from Supabase
  final pythonStyleHash = "\$2b\$12\$UrR20i2e9wfxUbPQYZ01s.5E4hkQ58CL08smtWBOTgqhzdXe7o2Iy";
  
  try {
    final matchesPython = BCrypt.checkpw(testPassword, pythonStyleHash);
    print("Password matches Python hash: $matchesPython");
  } catch (e) {
    print("Error checking Python hash: $e");
  }
}
