// Rumus "Cuci IKM" untuk satu baris detail (alias td) pada transaksi PROSES (alias t).
// Linen bersih baru dianggap kembali ke Lemari setelah serah terimanya SAH:
//  - transaksi wajib TTD per unit (t.unit_sign_required = 1) dan ruangan bukan Gudang Linen:
//    setelah ruangan itu TTD unit delivery (TTD perawat + TTD valet)
//  - selain itu (RS tanpa TTD per unit, Gudang Linen, baris tanpa ruangan):
//    setelah TTD Petugas RS pada pengiriman bersih (umum)
// Jumlah bersih yang baru "disimpan sementara" tetap dihitung Cuci IKM.
const DELIVERY_SAH_SQL = `(CASE
    WHEN t.unit_sign_required = 1 AND td.room_id IS NOT NULL
         AND COALESCE((SELECT rr.is_gudang_linen FROM mst_rooms_rs rr WHERE rr.id = td.room_id), 0) = 0
      THEN EXISTS (SELECT 1 FROM tr_linen_transaction_room_sign rsg
                    WHERE rsg.transaction_id = t.id AND rsg.room_id = td.room_id
                      AND rsg.signature_nurse_delivery IS NOT NULL AND rsg.signature_nurse_delivery <> ''
                      AND rsg.signature_valet_delivery IS NOT NULL AND rsg.signature_valet_delivery <> '')
    ELSE COALESCE(t.signature_hospital_delivery, '') <> ''
  END)`;

export const CUCI_QTY_SQL = `(td.qty_kotor - CASE WHEN ${DELIVERY_SAH_SQL} THEN LEAST(COALESCE(td.qty_bersih, 0), td.qty_kotor) ELSE 0 END)`;
