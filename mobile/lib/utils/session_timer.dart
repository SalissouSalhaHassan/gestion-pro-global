import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../screens/login_screen.dart';
import '../providers/auth_provider.dart';

class SessionTimer extends StatefulWidget {
  final Widget child;
  final Duration duration;

  const SessionTimer({
    super.key,
    required this.child,
    this.duration = const Duration(minutes: 5), // مدة الخمول المسموحة
  });

  @override
  State<SessionTimer> createState() => _SessionTimerState();
}

class _SessionTimerState extends State<SessionTimer> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer(widget.duration, _handleTimeout);
  }

  void _handleUserInteraction([_]) {
    // إعادة ضبط المؤقت عند أي لمسة
    _startTimer();
  }

  void _handleTimeout() async {
    // عند انتهاء الوقت، نرجع لشاشة الدخول
    if (mounted) {
      // Logout user
      await Provider.of<AuthProvider>(context, listen: false).logout();
      
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
          (route) => false,
        );

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Session expirée pour inactivité"),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: _handleUserInteraction,
      onPointerMove: _handleUserInteraction,
      onPointerUp: _handleUserInteraction,
      child: widget.child,
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
