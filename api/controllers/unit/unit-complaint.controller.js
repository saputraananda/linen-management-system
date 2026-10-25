export {
  uploadPhotos, getOptions, getLinenOptions, listComplaints, getComplaint,
  createComplaint, updateComplaint, deleteComplaint,
} from '../../utils/complaintCore.js';

// Tim Unit hanya mengajukan & mengelola komplain miliknya; persetujuan ada di Tim Linen RS.
export const requireUnit = (req, res, next) => (req.user.role === 'unit'
  ? next()
  : res.status(403).json({ success: false, message: 'Akses ditolak' }));
