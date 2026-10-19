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
  DateTime _lastInteraction = DateTime.now();

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
      _timer?.cancel();
    } else if (state == AppLifecycleState.resumed) {
      if (_pausedTime != null) {
        final elapsed = DateTime.now().difference(_pausedTime!);
        if (elapsed >= widget.duration) {
          _handleTimeout();
        } else {
          final remaining = widget.duration - elapsed;
          _startTimer(remaining);
        }
        _pausedTime = null;
      }
    }
  }

  void _startTimer([Duration? customDuration]) {
    _timer?.cancel();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.isAuth && !auth.isLocked) {
      _timer = Timer(customDuration ?? widget.duration, _handleTimeout);
    }
  }

  void _handleUserInteraction([_]) {
    final now = DateTime.now();
    if (now.difference(_lastInteraction).inMilliseconds < 500) {
      return;
    }
    _lastInteraction = now;

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
        if (auth.isAuth && !auth.isLocked && (_timer == null || !_timer!.isActive)) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && !auth.isLocked && (_timer == null || !_timer!.isActive)) {
              _startTimer();
            }
          });
        }

        return Listener(
          behavior: HitTestBehavior.translucent,
          onPointerDown: _handleUserInteraction,
          child: Stack(
            children: [
              widget.child,
              if (auth.isAuth && auth.isLocked)
                const Positioned.fill(
                  child: PopScope(
                    canPop: false,
                    child: LockScreen(),
                  ),
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
