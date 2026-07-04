/**
 * System Information Controller
 */
export const getSystemInfo = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Selamat Datang di PT Waschen Alora Indonesia - Linen Monitoring System API",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      status: "Operational",
      timestamp: new Date().toISOString(),
      database: {
        status: "Mock Connection Successful",
        client: "MySQL 2"
      },
      metrics: {
        rfidScannerStatus: "ONLINE",
        laundryProcessingUnit: "ACTIVE",
        activeTrackedLinens: 1248,
        pendingDispatchCount: 45
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil informasi sistem backend",
      error: error.message
    });
  }
};
