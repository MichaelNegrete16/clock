import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "servers.json");

// Asegurar que el archivo existe
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initialData = {
      servers: [],
      interval: 1,
      isRunning: false,
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

// GET - Obtener servidores
export async function GET() {
  try {
    await ensureDataFile();
    const data = await fs.readFile(DATA_FILE, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error("Error leyendo servidores:", error);
    return NextResponse.json({ error: "Error al leer datos" }, { status: 500 });
  }
}

// POST - Guardar servidores
export async function POST(request: Request) {
  try {
    const body = await request.json();
    await ensureDataFile();
    await fs.writeFile(DATA_FILE, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error guardando servidores:", error);
    return NextResponse.json(
      { error: "Error al guardar datos" },
      { status: 500 }
    );
  }
}
