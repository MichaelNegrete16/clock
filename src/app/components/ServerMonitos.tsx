"use client";

import React, { useState, useEffect, useRef } from "react";

interface Server {
  id: number;
  url: string;
  status: "idle" | "success" | "warning" | "error";
  lastPing: string;
  responseTime: number | null;
  errorCount: number;
}

interface Log {
  id: number;
  message: string;
  timestamp: string;
  type: "success" | "error" | "warning" | "info";
}

export default function ServerMonitor() {
  const [servers, setServers] = useState<Server[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [pingInterval, setPingInterval] = useState(1); // Renombrado de interval a pingInterval
  const [logs, setLogs] = useState<Log[]>([]);
  const serversRef = useRef<Server[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Definir addLog ANTES de usarlo
  const addLog = (message: string, type: Log["type"]) => {
    const timestamp = new Date().toLocaleTimeString("es-ES");
    setLogs((prev) =>
      [
        {
          id: Date.now(),
          message,
          timestamp,
          type,
        },
        ...prev,
      ].slice(0, 50)
    );
  };

  // Cargar servidores y configuración desde localStorage al montar
  useEffect(() => {
    const savedServers = localStorage.getItem("monitorServers");
    const savedInterval = localStorage.getItem("monitorInterval");
    const savedIsRunning = localStorage.getItem("monitorIsRunning");

    if (savedServers) {
      try {
        const parsed = JSON.parse(savedServers);
        setServers(parsed);
        serversRef.current = parsed;
      } catch (error) {
        console.error("Error al cargar servidores:", error);
      }
    }

    if (savedInterval) {
      const parsedInterval = parseInt(savedInterval);
      if (!isNaN(parsedInterval) && parsedInterval > 0) {
        setPingInterval(parsedInterval);
      }
    }

    if (savedIsRunning === "true") {
      setIsRunning(true);
      addLog("▶ Monitoreo reanudado automáticamente", "info");
    }
  }, []);

  // Guardar servidores en localStorage cuando cambien
  useEffect(() => {
    if (servers.length > 0) {
      localStorage.setItem("monitorServers", JSON.stringify(servers));
    } else {
      localStorage.removeItem("monitorServers");
    }
    serversRef.current = servers;
  }, [servers]);

  // Guardar intervalo en localStorage
  useEffect(() => {
    if (pingInterval && !isNaN(pingInterval)) {
      localStorage.setItem("monitorInterval", pingInterval.toString());
    }
  }, [pingInterval]);

  // Guardar estado de monitoreo en localStorage
  useEffect(() => {
    localStorage.setItem("monitorIsRunning", isRunning.toString());
  }, [isRunning]);

  const checkWithImage = (id: number, url: string, timestamp: string) => {
    console.log(`🖼️ [checkWithImage] Intentando ping con imagen a: ${url}`);
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const img = new Image();

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        cleanup();
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        console.log(
          `✅ [checkWithImage] Éxito con imagen - ${url} (${responseTime}ms)`
        );

        setServers((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "success",
                  lastPing: timestamp,
                  responseTime,
                  errorCount: 0,
                }
              : s
          )
        );
        addLog(`✓ ${url} - Servidor activo (${responseTime}ms)`, "success");
        resolve();
      };

      img.onerror = () => {
        cleanup();
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (responseTime < 5000) {
          console.log(
            `✅ [checkWithImage] Respuesta rápida detectada - ${url} (${responseTime}ms)`
          );
          setServers((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    status: "success",
                    lastPing: timestamp,
                    responseTime,
                    errorCount: 0,
                  }
                : s
            )
          );
          addLog(`✓ ${url} - Servidor activo (${responseTime}ms)`, "success");
        } else {
          console.log(`❌ [checkWithImage] Error - ${url} (${responseTime}ms)`);
          setServers((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    status: "error",
                    lastPing: timestamp,
                    errorCount: (s.errorCount || 0) + 1,
                  }
                : s
            )
          );
          addLog(`✗ ${url} - No se pudo conectar`, "error");
        }
        resolve();
      };

      img.src = url + (url.includes("?") ? "&" : "?") + "_ping=" + Date.now();

      setTimeout(() => {
        cleanup();
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        console.log(`⚠️ [checkWithImage] Timeout - ${url} (${responseTime}ms)`);

        setServers((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "warning",
                  lastPing: timestamp,
                  responseTime,
                  errorCount: 0,
                }
              : s
          )
        );
        addLog(`⚠ ${url} - Respuesta lenta (${responseTime}ms)`, "warning");
        resolve();
      }, 8000);
    });
  };

  const pingServer = async (id: number, url: string) => {
    const timestamp = new Date().toLocaleTimeString("es-ES");
    console.log(`🔔 [pingServer] Iniciando ping a: ${url} a las ${timestamp}`);

    try {
      const startTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log(`📡 [pingServer] Ejecutando fetch a: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        cache: "no-cache",
      });

      clearTimeout(timeoutId);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(
        `✅ [pingServer] Fetch exitoso - ${url} - Status: ${response.status} (${responseTime}ms)`
      );

      setServers((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: "success",
                lastPing: timestamp,
                responseTime,
                errorCount: 0,
              }
            : s
        )
      );

      addLog(`✓ ${url} - Servidor respondiendo (${responseTime}ms)`, "success");
    } catch (error) {
      if (error instanceof Error && error.name === "TypeError") {
        console.log(
          `⚠️ [pingServer] TypeError (probablemente CORS) - ${url}, intentando con imagen...`
        );
        await checkWithImage(id, url, timestamp);
      } else if (error instanceof Error && error.name === "AbortError") {
        console.log(`❌ [pingServer] AbortError (timeout) - ${url}`);
        setServers((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "error",
                  lastPing: timestamp,
                  errorCount: (s.errorCount || 0) + 1,
                }
              : s
          )
        );
        addLog(`✗ ${url} - Timeout (sin respuesta)`, "error");
      } else {
        console.log(`❌ [pingServer] Error desconocido - ${url}:`, error);
        setServers((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "error",
                  lastPing: timestamp,
                  errorCount: (s.errorCount || 0) + 1,
                }
              : s
          )
        );
        addLog(
          `✗ ${url} - Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "error"
        );
      }
    }
  };

  // Efecto para el monitoreo automático usando la referencia
  useEffect(() => {
    // Limpiar intervalo anterior si existe
    if (intervalRef.current) {
      console.log("🧹 [useEffect] Limpiando intervalo anterior");
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isRunning) {
      console.log("⏸️ [useEffect] Monitoreo pausado");
      return;
    }

    console.log(
      `▶️ [useEffect] Iniciando monitoreo cada ${pingInterval} minuto(s)`
    );
    console.log(
      `📋 [useEffect] Servidores a monitorear:`,
      serversRef.current.map((s) => s.url)
    );

    // Hacer ping inicial inmediatamente al iniciar
    console.log("🚀 [useEffect] Ejecutando ping inicial...");
    serversRef.current.forEach((server) => {
      pingServer(server.id, server.url);
    });

    // Configurar el intervalo para pings posteriores
    intervalRef.current = setInterval(() => {
      console.log(
        `⏰ [setInterval] Ejecutando ping automático (cada ${pingInterval} minutos)`
      );
      console.log(
        `📋 [setInterval] Cantidad de servidores:`,
        serversRef.current.length
      );
      serversRef.current.forEach((server) => {
        pingServer(server.id, server.url);
      });
    }, pingInterval * 60 * 1000);

    console.log(
      `✅ [useEffect] Intervalo configurado: ID=${intervalRef.current}`
    );

    // Cleanup al desmontar o cuando cambie la dependencia
    return () => {
      console.log(
        "🧹 [useEffect cleanup] Limpiando intervalo al desmontar o cambiar dependencias"
      );
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, pingInterval]);

  const addServer = () => {
    if (!newUrl.trim()) return;

    let formattedUrl = newUrl.trim();
    if (
      !formattedUrl.startsWith("http://") &&
      !formattedUrl.startsWith("https://")
    ) {
      formattedUrl = "https://" + formattedUrl;
    }

    const newServer: Server = {
      id: Date.now(),
      url: formattedUrl,
      status: "idle",
      lastPing: "Nunca",
      responseTime: null,
      errorCount: 0,
    };

    setServers((prev) => [...prev, newServer]);
    setNewUrl("");
    addLog(`+ Servidor agregado: ${formattedUrl}`, "info");
  };

  const removeServer = (id: number) => {
    const server = servers.find((s) => s.id === id);
    setServers((prev) => prev.filter((s) => s.id !== id));
    if (server) {
      addLog(`- Servidor eliminado: ${server.url}`, "info");
    }
  };

  const toggleMonitoring = () => {
    setIsRunning(!isRunning);
    addLog(isRunning ? "⏸ Monitoreo pausado" : "▶ Monitoreo iniciado", "info");
  };

  const pingNow = (id: number, url: string) => {
    pingServer(id, url);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #0f172a, #1e293b)",
        padding: "1.5rem",
      }}
    >
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        <div
          style={{
            background: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(to right, #2563eb, #1d4ed8)",
              padding: "1.5rem",
              color: "white",
            }}
          >
            <h1
              style={{
                fontSize: "1.875rem",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                margin: 0,
              }}
            >
              <span style={{ fontSize: "2rem" }}>⚡</span>
              Monitor de Servidores
            </h1>
            <p style={{ marginTop: "0.5rem", color: "#bfdbfe" }}>
              Mantén tus servidores activos con pings automáticos
            </p>
          </div>

          {/* Info Banner */}
          <div
            style={{
              background: "#eff6ff",
              borderBottom: "1px solid #bfdbfe",
              padding: "1rem",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "start", gap: "0.75rem" }}
            >
              <span style={{ color: "#2563eb", fontSize: "1.25rem" }}>ℹ️</span>
              <div style={{ fontSize: "0.875rem", color: "#1e40af" }}>
                <p style={{ fontWeight: "500", margin: 0 }}>Cómo funciona:</p>
                <p style={{ marginTop: "0.25rem" }}>
                  Esta herramienta hace peticiones HTTP a tus servidores para
                  mantenerlos activos. Los datos se guardan localmente y el
                  monitoreo continúa mientras la página esté abierta.
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div
            style={{
              padding: "1.5rem",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                alignItems: "end",
              }}
            >
              <div style={{ flex: "1 1 16rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "0.5rem",
                  }}
                >
                  URL del Servidor
                </label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addServer()}
                  placeholder="ejemplo.com o https://miservidor.com"
                  style={{
                    width: "100%",
                    padding: "0.5rem 1rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                />
              </div>
              <button
                onClick={addServer}
                style={{
                  padding: "0.5rem 1.5rem",
                  background: "#2563eb",
                  color: "white",
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "1rem",
                }}
              >
                <span>➕</span>
                Agregar
              </button>
              <div style={{ flex: "1 1 12rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "0.5rem",
                  }}
                >
                  Intervalo (minutos)
                </label>
                <input
                  type="number"
                  value={pingInterval}
                  onChange={(e) =>
                    setPingInterval(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  min="1"
                  style={{
                    width: "100%",
                    padding: "0.5rem 1rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                />
              </div>
              <button
                onClick={toggleMonitoring}
                disabled={servers.length === 0}
                style={{
                  padding: "0.5rem 1.5rem",
                  background: isRunning ? "#ea580c" : "#16a34a",
                  color: "white",
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: servers.length === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  opacity: servers.length === 0 ? 0.5 : 1,
                  fontSize: "1rem",
                }}
              >
                {isRunning ? (
                  <>
                    <span>⏸️</span>
                    Pausar
                  </>
                ) : (
                  <>
                    <span>▶️</span>
                    Iniciar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Server List */}
          <div style={{ padding: "1.5rem" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: "#1f2937",
                marginBottom: "1rem",
              }}
            >
              Servidores Monitoreados ({servers.length})
            </h2>

            {servers.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 0",
                  color: "#6b7280",
                }}
              >
                <div
                  style={{
                    fontSize: "4rem",
                    marginBottom: "1rem",
                    opacity: 0.2,
                  }}
                >
                  ⚡
                </div>
                <p style={{ fontSize: "1.125rem" }}>
                  No hay servidores agregados
                </p>
                <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                  Agrega una URL arriba para comenzar
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {servers.map((server) => (
                  <div
                    key={server.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "1rem",
                      border: "1px solid",
                      borderColor:
                        server.status === "success"
                          ? "#bbf7d0"
                          : server.status === "warning"
                          ? "#fef08a"
                          : server.status === "error"
                          ? "#fecaca"
                          : "#e5e7eb",
                      background:
                        server.status === "success"
                          ? "#f0fdf4"
                          : server.status === "warning"
                          ? "#fefce8"
                          : server.status === "error"
                          ? "#fef2f2"
                          : "white",
                      borderRadius: "0.5rem",
                      transition: "box-shadow 0.2s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        flex: 1,
                      }}
                    >
                      <span style={{ fontSize: "1.5rem" }}>
                        {server.status === "success"
                          ? "✅"
                          : server.status === "warning"
                          ? "⚠️"
                          : server.status === "error"
                          ? "❌"
                          : "⚪"}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontWeight: "500",
                            color: "#1f2937",
                            margin: 0,
                          }}
                        >
                          {server.url}
                        </p>
                        <p
                          style={{
                            fontSize: "0.875rem",
                            color: "#6b7280",
                            margin: "0.25rem 0 0 0",
                          }}
                        >
                          Último ping: {server.lastPing}
                          {server.responseTime && ` • ${server.responseTime}ms`}
                          {server.errorCount > 0 &&
                            ` • ${server.errorCount} errores`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => pingNow(server.id, server.url)}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#dbeafe",
                          color: "#1e40af",
                          borderRadius: "0.5rem",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                        }}
                      >
                        Ping Ahora
                      </button>
                      <button
                        onClick={() => removeServer(server.id)}
                        style={{
                          padding: "0.5rem",
                          background: "#fee2e2",
                          color: "#991b1b",
                          borderRadius: "0.5rem",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "1.25rem",
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logs */}
          <div
            style={{
              padding: "1.5rem",
              background: "#f9fafb",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: "#1f2937",
                marginBottom: "1rem",
              }}
            >
              Registro de Actividad
            </h2>
            <div
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
                padding: "1rem",
                maxHeight: "16rem",
                overflowY: "auto",
              }}
            >
              {logs.length === 0 ? (
                <p
                  style={{
                    color: "#6b7280",
                    textAlign: "center",
                    padding: "1rem",
                  }}
                >
                  Sin actividad aún
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        fontSize: "0.875rem",
                        padding: "0.5rem",
                        borderRadius: "0.25rem",
                        background:
                          log.type === "success"
                            ? "#f0fdf4"
                            : log.type === "error"
                            ? "#fef2f2"
                            : log.type === "warning"
                            ? "#fefce8"
                            : "#eff6ff",
                        color:
                          log.type === "success"
                            ? "#166534"
                            : log.type === "error"
                            ? "#991b1b"
                            : log.type === "warning"
                            ? "#854d0e"
                            : "#1e40af",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          opacity: 0.75,
                        }}
                      >
                        [{log.timestamp}]
                      </span>{" "}
                      {log.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
