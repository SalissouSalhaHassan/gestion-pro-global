import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";

    let query = supabase.from('vehicle_records').select(`
      *,
      voitures (
        matricule,
        marque,
        modele,
        date_expiration,
        date_assurance_exp
      )
    `).eq('organization_id', orgId);
    
    if (vehicleId) query = query.eq('voiture_id', vehicleId);
    if (type) query = query.eq('record_type', type);
    if (startDate) query = query.gte('record_date', startDate);
    if (endDate) query = query.lte('record_date', endDate);
    
    const { data, error } = await query.order('record_date', { ascending: false });
    
    if (error) {
      console.warn('Vehicle records query warning:', error.message);
      return NextResponse.json([]);
    }
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Vehicle records GET error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    
    const { data: result, error } = await supabase
      .from('vehicle_records')
      .upsert({
        ...data,
        organization_id: orgId
      })
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
    } else if (cat.includes('vignette') && data.end_date) {
      vehicleUpdates.date_expiration = data.end_date;
    }
    
    if (Object.keys(vehicleUpdates).length > 0 && data.voiture_id) {
      await supabase.from('voitures').update(vehicleUpdates).eq('id', data.voiture_id).eq('organization_id', orgId);
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Vehicle records POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
