import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const STORAGE_KEY = "server-monitor-data";

interface ServerData {
  servers: Array<{
    id: number;
    url: string;
    status: "idle" | "success" | "warning" | "error";
    lastPing: string;
    responseTime: number | null;
    errorCount: number;
  }>;
  interval: number;
  isRunning: boolean;
}

// Datos iniciales
const defaultData: ServerData = {
  servers: [],
  interval: 1,
  isRunning: false,
};

// GET - Obtener servidores
export async function GET() {
  try {
    const data = await kv.get<ServerData>(STORAGE_KEY);

    // Si no hay datos, devolver los valores por defecto
    if (!data) {
      await kv.set(STORAGE_KEY, defaultData);
      return NextResponse.json(defaultData);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error leyendo datos de KV:", error);
    return NextResponse.json({ error: "Error al leer datos" }, { status: 500 });
  }
}

// POST - Guardar servidores
export async function POST(request: Request) {
  try {
    const body = await request.json();
    await kv.set(STORAGE_KEY, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error guardando datos en KV:", error);
    return NextResponse.json(
      { error: "Error al guardar datos" },
      { status: 500 }
    );
  }
}
