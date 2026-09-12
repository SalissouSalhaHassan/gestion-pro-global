import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class TopProductsWidget extends StatelessWidget {
  final List<Map<String, dynamic>> products;

  const TopProductsWidget({Key? key, required this.products}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final numberFormat = NumberFormat("#,##0", "fr_FR");
    return Column(
      children: [
        if (products.isEmpty)
           Padding(
             padding: const EdgeInsets.symmetric(vertical: 20),
             child: Text("Aucune donnée", style: TextStyle(color: Colors.white.withOpacity(0.5))),
           ),
           
        ...products.map((p) {
          final int index = products.indexOf(p);
          final name = (p['name'] ?? 'Inconnu').toString();
          final qty = (p['quantity'] as num?)?.toDouble() ?? 0.0;
          final revenueRaw = p.containsKey('revenue') ? p['revenue'] : p['total'];
          final revenue = (revenueRaw as num?)?.toDouble() ?? 0.0;
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.blueAccent, Colors.purpleAccent.withOpacity(0.6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      "${index + 1}",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "${qty.toStringAsFixed(qty == qty.roundToDouble() ? 0 : 1)} vendus",
                        style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11),
                      ),
                    ],
                  ),
                ),
                Text(
                  "${numberFormat.format(revenue)} F",
                  style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ],
            ),
          );
        }).toList()
      ],
    );
  }
}
