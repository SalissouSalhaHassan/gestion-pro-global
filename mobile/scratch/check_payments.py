from supabase import create_client
import json

url = 'https://ktunkjugqpebsdrvorka.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dW5ranVncXBlYnNkcnZvcmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjYzMzUsImV4cCI6MjA5MTkwMjMzNX0.wrYZU8XCCwUSxxyidbrQXPxVNaDNNWc5gfR1ZPMljYc'

supabase = create_client(url, key)

try:
    # Get shipment details for truck 4345RN
    shipments = supabase.table('gestion_ciment').select('*').eq('camion_no', '4345RN').execute()
    print('=== SHIPMENTS ===')
    print(json.dumps(shipments.data, indent=2))
    
    if shipments.data:
        shipment_id = shipments.data[0]['id']
        payments = supabase.table('ciment_paiements').select('*').eq('ciment_id', shipment_id).execute()
        print('=== PAYMENTS ===')
        print(json.dumps(payments.data, indent=2))
except Exception as e:
    print('Error:', e)
