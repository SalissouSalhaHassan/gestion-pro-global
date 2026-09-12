import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';

class SalesVsExpensesLineChart extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const SalesVsExpensesLineChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    double maxY = 0;
    for (final d in data) {
      final s = ((d['sales'] as num?)?.toDouble() ?? 0.0);
      final e = ((d['expenses'] as num?)?.toDouble() ?? 0.0);
      if (s > maxY) maxY = s;
      if (e > maxY) maxY = e;
    }
    if (maxY == 0) maxY = 100;
    maxY *= 1.2;

    final salesSpots = List<FlSpot>.generate(
      data.length,
      (i) => FlSpot(i.toDouble(), ((data[i]['sales'] as num?)?.toDouble() ?? 0.0)),
    );
    final expensesSpots = List<FlSpot>.generate(
      data.length,
      (i) => FlSpot(i.toDouble(), ((data[i]['expenses'] as num?)?.toDouble() ?? 0.0)),
    );

    return Container(
      height: 250,
      padding: const EdgeInsets.all(8),
      child: LineChart(
        LineChartData(
          maxY: maxY,
          minY: 0,
          gridData: const FlGridData(show: false),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: 5,
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx >= 0 && idx < data.length) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        data[idx]['date']?.toString() ?? '',
                        style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 10),
                      ),
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              tooltipBgColor: Colors.indigo.withOpacity(0.8),
            ),
          ),
          borderData: FlBorderData(show: false),
          lineBarsData: [
            LineChartBarData(
              spots: salesSpots,
              isCurved: true,
              color: Colors.greenAccent,
              barWidth: 3,
              isStrokeCapRound: true,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  colors: [Colors.greenAccent.withOpacity(0.2), Colors.greenAccent.withOpacity(0)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
            LineChartBarData(
              spots: expensesSpots,
              isCurved: true,
              color: Colors.redAccent,
              barWidth: 3,
              isStrokeCapRound: true,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  colors: [Colors.redAccent.withOpacity(0.2), Colors.redAccent.withOpacity(0)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
