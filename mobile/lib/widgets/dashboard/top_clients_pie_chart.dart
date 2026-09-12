import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';

import 'package:intl/intl.dart';

class TopClientsPieChart extends StatelessWidget {
  final List<Map<String, dynamic>> topClients;
  const TopClientsPieChart({super.key, required this.topClients});

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.decimalPattern('fr');
    final colors = [
      Colors.blueAccent,
      Colors.greenAccent,
      const Color(0xFF6C63FF),
      Colors.orangeAccent,
      Colors.redAccent,
    ];
    final total = topClients.fold<double>(
      0,
      (sum, c) => sum + ((c['total'] as num?)?.toDouble() ?? 0.0),
    );
    final sections = List.generate(
      topClients.length,
      (i) {
        final value = ((topClients[i]['total'] as num?)?.toDouble() ?? 0.0);
        final pct = total > 0 ? (value / total) * 100 : 0.0;
        return PieChartSectionData(
          color: colors[i % colors.length],
          value: value,
          title: "${pct.toStringAsFixed(0)}%",
          radius: 35,
          titleStyle: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
        );
      },
    );
    return Row(
      children: [
        Expanded(
          flex: 1,
          child: PieChart(
            PieChartData(
              sectionsSpace: 4,
              centerSpaceRadius: 30,
              sections: sections,
            ),
          ),
        ),
        const SizedBox(width: 20),
        Expanded(
          flex: 2,
          child: ListView(
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            children: topClients.map((c) {
              final value = ((c['total'] as num?)?.toDouble() ?? 0.0);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: colors[topClients.indexOf(c) % colors.length],
                        borderRadius: BorderRadius.circular(4),
                        boxShadow: [
                          BoxShadow(
                            color: colors[topClients.indexOf(c) % colors.length].withOpacity(0.3),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        c['name']?.toString() ?? '',
                        style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13, fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      "${currencyFormat.format(value)}",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}
