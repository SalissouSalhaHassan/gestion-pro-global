import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/supabase_service.dart';

class UpdateService {
  static Future<void> checkUpdate(BuildContext context, {bool showNoUpdate = false}) async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;
      
      final config = await SupabaseService().getLatestAppConfig();
      if (config == null) return;

      final latestVersion = config['latest_version']?.toString();
      final downloadUrl = config['download_url']?.toString();
      final forceUpdate = config['force_update'] == true;
      final notes = config['release_notes']?.toString() ?? "Nouvelle version disponible";

      if (latestVersion != null && _isNewerVersion(currentVersion, latestVersion)) {
        if (context.mounted) {
          _showUpdateDialog(context, latestVersion, downloadUrl, forceUpdate, notes);
        }
      } else if (showNoUpdate) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Votre application est à jour")),
          );
        }
      }
    } catch (e) {
      debugPrint('Error checking for updates: $e');
    }
  }

  static bool _isNewerVersion(String current, String latest) {
    List<int> currentParts = current.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    List<int> latestParts = latest.split('.').map((e) => int.tryParse(e) ?? 0).toList();

    for (int i = 0; i < latestParts.length; i++) {
      int c = i < currentParts.length ? currentParts[i] : 0;
      int l = latestParts[i];
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  static void _showUpdateDialog(BuildContext context, String version, String? url, bool force, String notes) {
    showDialog(
      context: context,
      barrierDismissible: !force,
      builder: (ctx) => WillPopScope(
        onWillPop: () async => !force,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.system_update, color: Color(0xFF4A00E0)),
              const SizedBox(width: 10),
              const Text("Mise à jour"),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Une nouvelle version ($version) est disponible.", 
                style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              Text(notes, style: TextStyle(color: Colors.grey.shade700, fontSize: 14)),
              if (force) ...[
                const SizedBox(height: 15),
                const Text("Cette mise à jour est obligatoire pour continuer à utiliser l'application.",
                  style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ],
          ),
          actions: [
            if (!force)
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text("Plus tard"),
              ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4A00E0),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                if (url != null && url.isNotEmpty) {
                  try {
                    String urlToLaunch = url.trim();
                    // Auto-fix missing protocol
                    if (!urlToLaunch.startsWith('http://') && !urlToLaunch.startsWith('https://')) {
                      urlToLaunch = 'https://$urlToLaunch';
                    }
                    
                    final uri = Uri.parse(urlToLaunch);
                    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
                    if (!launched) {
                      throw 'Could not launch $urlToLaunch';
                    }
                  } catch (e) {
                    debugPrint('Update launch error: $e');
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text("Lien invalide: $url. Assurez-vous qu'il commence par https://"),
                          backgroundColor: Colors.redAccent,
                          duration: const Duration(seconds: 5),
                        ),
                      );
                    }
                  }
                } else {
                   if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Le lien de téléchargement est vide.")),
                      );
                   }
                }
              },
              child: const Text("TÉLÉCHARGER", style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
