import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const STORAGE_KEY = "server-monitor-data";

interface Server {
  id: number;
  url: string;
  status: "idle" | "success" | "warning" | "error";
  lastPing: string;
  responseTime: number | null;
  errorCount: number;
}

interface ServerData {
  servers: Server[];
  interval: number;
  isRunning: boolean;
}

async function pingUrl(
  url: string
): Promise<{ success: boolean; responseTime: number; status: string }> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-cache",
    });

    clearTimeout(timeoutId);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log(`✅ Ping exitoso a ${url} - ${responseTime}ms`);

    return {
      success: true,
      responseTime,
      status: "success",
    };
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      console.log(`❌ Timeout en ${url}`);
      return { success: false, responseTime, status: "error" };
    }

    console.log(`⚠️ Error en ${url}:`, error);
    return { success: false, responseTime, status: "error" };
  }
}

// Esta ruta ejecutará los pings automáticamente
export async function GET() {
  try {
    // Obtener datos de KV
    const data = await kv.get<ServerData>(STORAGE_KEY);

    if (!data || !data.isRunning || data.servers.length === 0) {
      return NextResponse.json({
        message: "Monitoreo pausado o sin servidores",
        skipped: true,
      });
    }

    const timestamp = new Date().toLocaleTimeString("es-ES");
    const results = [];

    // Hacer ping a cada servidor
    for (const server of data.servers) {
      const result = await pingUrl(server.url);

      results.push({
        url: server.url,
        ...result,
      });

      // Actualizar el servidor en el array
      server.status = result.status as any;
      server.lastPing = timestamp;
      server.responseTime = result.responseTime;
      server.errorCount = result.success ? 0 : (server.errorCount || 0) + 1;
    }

    // Guardar los datos actualizados
    await kv.set(STORAGE_KEY, data);

    console.log(`🔔 Ping automático ejecutado: ${results.length} servidores`);

    return NextResponse.json({
      message: "Pings ejecutados",
      timestamp,
      results,
    });
  } catch (error) {
    console.error("❌ Error en ping automático:", error);
    return NextResponse.json(
      { error: "Error ejecutando pings" },
      { status: 500 }
    );
  }
}

// Permitir POST también para triggers manuales
export async function POST() {
  return GET();
}
