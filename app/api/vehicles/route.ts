import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    const supabase = await createClient();
    let query = supabase.from('voitures').select('*').eq('is_deleted', false);
    
    if (search) {
      query = query.or(`matricule.ilike.%${search}%,marque.ilike.%${search}%,modele.ilike.%${search}%,chauffeur.ilike.%${search}%`);
    }
    
    const { data, error } = await query.order('matricule');
    
    if (error) {
      console.warn('Vehicles query warning:', error.message);
      return NextResponse.json([]);
    }
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Vehicles GET error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const supabase = await createClient();
    
    const { data: result, error } = await supabase
      .from('voitures')
      .upsert({
        ...data,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) throw error;
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Vehicles POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
