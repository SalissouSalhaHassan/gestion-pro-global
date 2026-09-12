import 'package:blue_thermal_printer/blue_thermal_printer.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';
import 'dart:convert';
// Wi‑Fi printing support
import 'package:multicast_dns/multicast_dns.dart';

// simple holder for discovered network printers
class NetworkDevice {
  final String name;
  final String ip;
  NetworkDevice(this.name, this.ip);
}

class PrinterScreen extends StatefulWidget {
  final Map<String, dynamic>? invoiceData;

  const PrinterScreen({super.key, this.invoiceData});

  @override
  State<PrinterScreen> createState() => _PrinterScreenState();
}

class _PrinterScreenState extends State<PrinterScreen> {
  BlueThermalPrinter bluetooth = BlueThermalPrinter.instance;

  // bluetooth state
  List<BluetoothDevice> _devices = [];
  BluetoothDevice? _selectedDevice;

  // wifi state
  bool _wifiMode = false; // when true we use network printer
  String _wifiAddress = '';
  int _wifiPort = 9100;
  Socket? _wifiSocket;

  // mDNS discovery
  List<NetworkDevice> _networkDevices = [];
  bool _mdnsScanning = false;

  bool _connected = false;
  bool _isLoading = false;
  bool _isScanning = false;

  // ألوان التطبيق الموحدة
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);

  @override
  void initState() {
    super.initState();
    _initPrinter();
  }

  Future<void> _initPrinter() async {
    // scan for bluetooth devices only, wifi printing uses manual address
    if (_wifiMode) return;

    setState(() => _isScanning = true);

    // طلب الصلاحيات
    await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();

    bool? isConnected = await bluetooth.isConnected;
    List<BluetoothDevice> devices = [];

    try {
      devices = await bluetooth.getBondedDevices();
    } catch (e) {
      debugPrint("Erreur devices: $e");
    }

    if (mounted) {
      setState(() {
        _devices = devices;
        _connected = isConnected ?? false;
        _isScanning = false;
      });
    }
  }

  Future<void> _connect() async {
    if (_wifiMode) {
      await _connectWifi();
      return;
    }

    if (_selectedDevice != null) {
      setState(() => _isLoading = true);
      bluetooth
          .connect(_selectedDevice!)
          .then((_) {
            if (mounted) {
              setState(() {
                _connected = true;
                _isLoading = false;
              });
              _showSnackBar("Connecté avec succès !", Colors.green);
            }
          })
          .catchError((error) {
            if (mounted) {
              setState(() => _isLoading = false);
              _showSnackBar("Erreur de connexion", Colors.red);
            }
          });
    }
  }

  void _disconnect() {
    if (_wifiMode) {
      _disconnectWifi();
      return;
    }

    bluetooth.disconnect();
    if (mounted) {
      setState(() => _connected = false);
      _showSnackBar("Déconnecté", Colors.orange);
    }
  }

  Future<void> _connectWifi() async {
    if (_wifiAddress.trim().isEmpty) {
      _showSnackBar("Veuillez entrer l'adresse IP", Colors.red);
      return;
    }
    setState(() => _isLoading = true);
    try {
      _wifiSocket = await Socket.connect(_wifiAddress, _wifiPort, timeout: const Duration(seconds: 5));
      _wifiSocket!.write("\x1B\x40"); // init
      setState(() {
        _connected = true;
        _isLoading = false;
      });
      _showSnackBar("Connecté (Wi‑Fi)", Colors.green);
    } catch (e) {
      setState(() {
        _isLoading = false;
        _connected = false;
      });
      _showSnackBar("Échec de connexion Wi‑Fi", Colors.red);
    }
  }

  void _disconnectWifi() {
    _wifiSocket?.destroy();
    _wifiSocket = null;
    setState(() => _connected = false);
    _showSnackBar("Déconnecté Wi‑Fi", Colors.orange);
  }

  void _printReceipt() {
    if (!_connected) {
      _showSnackBar("Veuillez connecter une imprimante", Colors.red);
      return;
    }

    if (_wifiMode) {
      _printReceiptWifi();
      return;
    }

    // bluetooth printing as before
    bluetooth.isConnected.then((isConnected) {
      if (isConnected == true) {
        // --- بداية الطباعة ---
        bluetooth.printNewLine();
        // يمكنك تغيير الشعار أو الاسم هنا
        bluetooth.printCustom(
          "GESTION PRO",
          3,
          1,
        ); // 0=Small, 1=Normal, 2=Large, 3=Extra Large | 1=Center
        bluetooth.printCustom("Vente & Distribution", 1, 1);
        bluetooth.printNewLine();

        if (widget.invoiceData != null) {
          final data = widget.invoiceData!;
          final date =
              data['date'] ?? DateTime.now().toString().substring(0, 16);
          final client = data['client'] ?? "Client divers";
          final total = data['total_amount'] ?? 0;
          final items = data['items'] as List<dynamic>? ?? [];
          final blNumber =
              data['bl_number'] ?? "Ticket #${DateTime.now().millisecond}";

          bluetooth.printLeftRight("Date:", date, 0);
          bluetooth.printLeftRight("Ref:", blNumber, 0);
          bluetooth.printLeftRight("Client:", client, 0);
          bluetooth.printCustom("--------------------------------", 1, 1);

          // العناوين
          bluetooth.printLeftRight("Article (Qte)", "Total", 1);
          bluetooth.printNewLine();

          // المنتجات
          for (var item in items) {
            String name = item['designation'] ?? item['name'] ?? "Article";
            // التأكد من تحويل الكميات والأسعار بشكل آمن
            double qty = double.tryParse(item['quantity'].toString()) ?? 1;
            double price = double.tryParse(item['price'].toString()) ?? 0;
            double lineTotal = qty * price;

            // طباعة الاسم
            bluetooth.printCustom(name, 1, 0);
            // طباعة التفاصيل: 5 x 1000 ...... 5000
            bluetooth.printLeftRight(
              "${qty.toInt()} x ${price.toInt()}",
              "${lineTotal.toInt()}",
              1,
            );
          }

          bluetooth.printCustom("--------------------------------", 1, 1);
          bluetooth.printNewLine();

          // الإجمالي بخط كبير
          bluetooth.printLeftRight("TOTAL:", "${total.toInt()} FCFA", 2);

          bluetooth.printNewLine();
        } else {
          // --- طباعة تجريبية ---
          bluetooth.printCustom("TEST D'IMPRESSION", 2, 1);
          bluetooth.printCustom("--------------------------------", 1, 1);
          bluetooth.printLeftRight("Produit A", "5000", 1);
          bluetooth.printLeftRight("Produit B", "2500", 1);
          bluetooth.printCustom("--------------------------------", 1, 1);
          bluetooth.printLeftRight("TOTAL:", "7500 FCFA", 2);
        }

        bluetooth.printNewLine();
        bluetooth.printCustom("Merci de votre visite !", 1, 1);
        bluetooth.printCustom("Software by GestionPro", 0, 1);
        bluetooth.printNewLine();
        bluetooth.printNewLine();
        bluetooth.paperCut(); // أمر قص الورق (لبعض الطابعات)
      }
    });
  }

  void _printReceiptWifi() {
    if (_wifiSocket == null) return;
    final socket = _wifiSocket!;
    String formatLine(String left, String right, {int width = 32}) {
      int space = width - left.length - right.length;
      if (space < 1) space = 1;
      return left + ' ' * space + right;
    }
    final buffer = StringBuffer();
    buffer.write('\x1B\x40'); // init
    buffer.write('GESTION PRO\n');
    buffer.write('Vente & Distribution\n\n');
    if (widget.invoiceData != null) {
      final data = widget.invoiceData!;
      final date = data['date'] ?? DateTime.now().toString().substring(0, 16);
      final client = data['client'] ?? "Client divers";
      final total = data['total_amount'] ?? 0;
      final items = data['items'] as List<dynamic>? ?? [];
      final blNumber = data['bl_number'] ?? "Ticket #${DateTime.now().millisecond}";

      buffer.write(formatLine('Date:', date) + '\n');
      buffer.write(formatLine('Ref:', blNumber) + '\n');
      buffer.write(formatLine('Client:', client) + '\n');
      buffer.write('--------------------------------\n');
      buffer.write(formatLine('Article (Qte)', 'Total') + '\n');

      for (var item in items) {
        String name = item['designation'] ?? item['name'] ?? "Article";
        double qty = double.tryParse(item['quantity'].toString()) ?? 1;
        double price = double.tryParse(item['price'].toString()) ?? 0;
        double lineTotal = qty * price;
        buffer.write('$name\n');
        buffer.write(formatLine('${qty.toInt()} x ${price.toInt()}', '${lineTotal.toInt()}') + '\n');
      }
      buffer.write('--------------------------------\n');
      buffer.write(formatLine('TOTAL:', '${total.toInt()} FCFA') + '\n');
    } else {
      buffer.write('TEST D\'IMPRESSION\n');
      buffer.write('--------------------------------\n');
      buffer.write(formatLine('Produit A', '5000') + '\n');
      buffer.write(formatLine('Produit B', '2500') + '\n');
      buffer.write('--------------------------------\n');
      buffer.write(formatLine('TOTAL:', '7500 FCFA') + '\n');
    }
    buffer.write('\n\nMerci de votre visite !\n');
    buffer.write('Software by GestionPro\n');
    buffer.write('\x1D\x56\x00'); // cut
    socket.add(utf8.encode(buffer.toString()));
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              color == Colors.green ? Icons.check_circle : Icons.info,
              color: Colors.white,
            ),
            const SizedBox(width: 10),
            Text(message),
          ],
        ),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(15),
      ),
    );
  }


  Future<void> _scanNetworkPrinters() async {
    setState(() {
      _networkDevices.clear();
      _mdnsScanning = true;
    });
    final MDnsClient client = MDnsClient();
    await client.start();
    // typical service types: _ipp._tcp.local or _pdl-datastream._tcp.local
    await for (final PtrResourceRecord ptr
        in client.lookup<PtrResourceRecord>(
            ResourceRecordQuery.serverPointer('_ipp._tcp.local')))
    {
      await for (final SrvResourceRecord srv
          in client.lookup<SrvResourceRecord>(
              ResourceRecordQuery.service(ptr.domainName))) {
        await for (final IPAddressResourceRecord ip
            in client.lookup<IPAddressResourceRecord>(
                ResourceRecordQuery.addressIPv4(srv.target))) {
          if (mounted) {
            _networkDevices.add(NetworkDevice(ptr.domainName, ip.address.address));
            // if first found, auto-populate address
            if (_wifiAddress.isEmpty) _wifiAddress = ip.address.address;
            setState(() {});
          }
        }
      }
    }
    client.stop();
    if (mounted) setState(() => _mdnsScanning = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F9),
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_primaryColor, _secondaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        title: const Text(
          "Configuration Imprimante",
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: _isScanning
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.refresh, color: Colors.white),
            onPressed: _wifiMode ? null : _initPrinter,
            tooltip: _wifiMode ? "Scan bluetooth désactivé" : "Actualiser les appareils",
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. حالة الطابعة (Header)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(30),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              children: [
                Icon(
                  _connected
                      ? (_wifiMode ? Icons.wifi : Icons.print_rounded)
                      : Icons.print_disabled_rounded,
                  size: 60,
                  color: _connected ? Colors.green : Colors.grey.shade400,
                ),
                const SizedBox(height: 10),
                Text(
                  _connected
                      ? "Imprimante Connectée"
                      : "Aucune imprimante connectée",
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: _connected ? Colors.green : Colors.grey.shade600,
                  ),
                ),
                if (_connected)
                  Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Text(
                      _wifiMode
                          ? _wifiAddress
                          : (_selectedDevice?.name ?? "Unknown Device"),
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // 2. قائمة الأجهزة وزر الاتصال
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ChoiceChip(
                        label: const Text('Bluetooth'),
                        selected: !_wifiMode,
                        onSelected: (v) {
                          setState(() {
                            _wifiMode = !v;
                            _connected = false;
                            _selectedDevice = null;
                            if (!_wifiMode) {
                              _devices = [];
                            }
                          });
                          if (!_wifiMode) _initPrinter();
                        },
                      ),
                      const SizedBox(width: 10),
                      ChoiceChip(
                        label: const Text('Wi-Fi'),
                        selected: _wifiMode,
                        onSelected: (v) {
                          setState(() {
                            _wifiMode = v;
                            _connected = false;
                            _selectedDevice = null;
                          });
                          if (v) _scanNetworkPrinters();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),

                  if (_wifiMode) ...[
                    const Text(
                      "Adresse IP imprimante",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: TextEditingController(text: _wifiAddress),
                            keyboardType: TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              hintText: 'ex: 192.168.0.123',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onChanged: (v) => _wifiAddress = v.trim(),
                          ),
                        ),
                        const SizedBox(width: 10),
                        IconButton(
                          icon: _mdnsScanning
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.search),
                          onPressed: _mdnsScanning ? null : _scanNetworkPrinters,
                          tooltip: 'Recherche mDNS',
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_networkDevices.isNotEmpty) ...[
                      const Text("Imprimantes trouvées:"),
                      const SizedBox(height: 5),
                      DropdownButton<String>(
                        value: _wifiAddress.isNotEmpty ? _wifiAddress : null,
                        hint: const Text('Choisir depuis la liste'),
                        items: _networkDevices.map((d) {
                          return DropdownMenuItem(
                              value: d.ip, child: Text('${d.name} (${d.ip})'));
                        }).toList(),
                        onChanged: (v) {
                          if (v != null) setState(() => _wifiAddress = v);
                        },
                      ),
                      const SizedBox(height: 20),
                    ],
                  ] else ...[
                    const Text(
                      "Appareils disponibles",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Dropdown داخل بطاقة
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 15,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<BluetoothDevice>(
                          value: _selectedDevice,
                          hint: const Text("Sélectionner une imprimante..."),
                          isExpanded: true,
                          icon: Icon(
                            Icons.arrow_drop_down_circle,
                            color: _primaryColor,
                          ),
                          items: _devices.map((device) {
                            return DropdownMenuItem(
                              value: device,
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.bluetooth,
                                    color: Colors.blue.shade700,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    device.name ?? "Inconnu",
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                          onChanged: (device) {
                            setState(() => _selectedDevice = device);
                            if (!_connected)
                              _connect(); // محاولة اتصال تلقائي عند الاختيار
                          },
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),

                  // أزرار التحكم
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: (_connected || _isLoading ||
                                  (_wifiMode ? _wifiAddress.isEmpty : _selectedDevice == null))
                              ? null
                              : _connect,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(
                                  _wifiMode ? "Connecter (Wi‑Fi)" : "Connecter",
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _connected ? _disconnect : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.redAccent,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: Text(
                            _wifiMode ? "Déconnecter (Wi‑Fi)" : "Déconnecter",
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // 3. زر الطباعة الكبير في الأسفل
          Container(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 55,
              child: ElevatedButton.icon(
                onPressed: _connected ? _printReceipt : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primaryColor,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                  elevation: 5,
                  shadowColor: _primaryColor.withOpacity(0.4),
                ),
                icon: const Icon(
                  Icons.print_rounded,
                  color: Colors.white,
                  size: 26,
                ),
                label: Text(
                  widget.invoiceData != null
                      ? "IMPRIMER LE TICKET"
                      : "TEST D'IMPRESSION",
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
