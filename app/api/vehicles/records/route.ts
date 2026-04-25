import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const supabase = await createClient();
    let query = supabase.from('vehicle_records').select(`
      *,
      voitures (
        matricule,
        marque,
        modele,
        date_expiration,
        date_assurance_exp
      )
    `);
    
    if (vehicleId) query = query.eq('voiture_id', vehicleId);
    if (type) query = query.eq('record_type', type);
    if (startDate) query = query.gte('record_date', startDate);
    if (endDate) query = query.lte('record_date', endDate);
    
    const { data, error } = await query.order('record_date', { ascending: false });
    
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Vehicle records GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const supabase = await createClient();
    
    const { data: result, error } = await supabase
      .from('vehicle_records')
      .upsert(data)
      .select()
      .single();
      
    if (error) {
      console.error('Supabase vehicle_records POST error:', error);
      throw error;
    }

    // Auto-update administrative dates in vehicle profile
    const cat = (data.category || '').toLowerCase();
    const vehicleUpdates: any = {};
    
    if (cat.includes('assurance') && data.end_date) {
      vehicleUpdates.date_assurance_exp = data.end_date;
    } else if ((cat.includes('vignette') || cat.includes('taxe')) && data.end_date) {
      vehicleUpdates.date_expiration = data.end_date;
    } else if (cat.includes('maintenance') || cat.includes('vidange')) {
      vehicleUpdates.derniere_maintenance = data.record_date;
    }

    if (Object.keys(vehicleUpdates).length > 0) {
      const { error: updateError } = await supabase.from('voitures').update(vehicleUpdates).eq('id', data.voiture_id);
      if (updateError) console.error('Vehicle auto-update error:', updateError);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Vehicle records POST full error:', error);
    return NextResponse.json({ 
      error: error.message || 'Erreur inconnue',
      details: error.details || error.hint || null
    }, { status: 500 });
  }
}
