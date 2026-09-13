import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../screens/lock_screen.dart';

class SessionTimer extends StatefulWidget {
  final Widget child;
  final Duration duration;

  const SessionTimer({
    super.key,
    required this.child,
    this.duration = const Duration(minutes: 3), // 3 minutes timeout
  });

  @override
  State<SessionTimer> createState() => _SessionTimerState();
}

class _SessionTimerState extends State<SessionTimer> with WidgetsBindingObserver {
  Timer? _timer;
  DateTime? _pausedTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startTimer();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _pausedTime = DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      if (_pausedTime != null) {
        final elapsed = DateTime.now().difference(_pausedTime!);
        if (elapsed >= widget.duration) {
          _handleTimeout();
        }
        _pausedTime = null;
      }
    }
  }

  void _startTimer() {
    _timer?.cancel();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.isAuth && !auth.isLocked) {
      _timer = Timer(widget.duration, _handleTimeout);
    }
  }

  void _handleUserInteraction([_]) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    auth.registerActivity();
    if (!auth.isLocked) {
      _startTimer();
    }
  }

  void _handleTimeout() {
    if (!mounted) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.isAuth && !auth.isLocked) {
      auth.lock();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        return Listener(
          behavior: HitTestBehavior.translucent,
          onPointerDown: _handleUserInteraction,
          onPointerMove: _handleUserInteraction,
          onPointerUp: _handleUserInteraction,
          child: Stack(
            children: [
              // Active application screen
              widget.child,

              // Lock Screen Overlay when session is locked
              if (auth.isAuth && auth.isLocked)
                const Positioned.fill(
                  child: LockScreen(),
                ),
            ],
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }
}
