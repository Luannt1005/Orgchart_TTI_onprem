'use client';

import { useEffect, useState, useCallback, useMemo, startTransition, useRef } from "react";
import {
  PlusIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ClockIcon,
  ShieldCheckIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  TrashIcon,
  NoSymbolIcon
} from "@heroicons/react/24/outline";
import styles from "@/app/SheetManager/sheet.module.css";
import useSWR from 'swr';
import { swrFetcher } from '@/lib/api-client';
import SheetAddModal from "./SheetAddModal";

interface SheetRow {
  id: string;
  [key: string]: any;
}

interface EditingCell {
  rowId: string;
  header: string;
}

// Configuration
const ITEMS_PER_PAGE = 20;

const VISIBLE_COLUMNS = [
  "Emp ID",
  "Dept",
  "Line Manager",
  "Is Direct",
  "Cost Center",
  "Joining\r\n Date",
  "FullName ",
  "Job Title",
  "Status",
  "Employee\r\n Type",
  "Location",
  "Last Working\r\nDay"
];

// Full list of columns for the "Add Employee" form
const ADD_FORM_COLUMNS = [
  "Emp ID",
  "FullName ",
  "Job Title",
  "Dept",
  "BU Org 3",
  "Cost Center",
  "Line Manager",
  "Is Direct",
  "Joining\r\n Date",
  "Status",
  "Location",
  "Employee\r\n Type",
  "DL/IDL/Staff",
  "Last Working\r\nDay"
];

const DATE_COLUMNS = ["Joining\r\n Date", "Last Working\r\nDay"];

const FILTER_COLUMNS = [
  "Emp ID",
  "Dept",
  "BU Org 3",
  "FullName ",
  "DL/IDL/Staff",
  "Is Direct"
];

// Helper functions
const normalizeFieldName = (fieldName: string): string => {
  return fieldName.replace(/[~*\/\[\]]/g, '_');
};

const denormalizeFieldName = (fieldName: string): string => {
  const mapping: { [key: string]: string } = {
    'DL_IDL_Staff': 'DL/IDL/Staff',
  };
  return mapping[fieldName] || fieldName;
};

const isLineManagerCol = (header: string) => {
  return header.trim().replace(/\r\n|\n/g, ' ') === "Line Manager";
};

const formatDate = (value: any): string => {
  if (!value) return "";
  try {
    // Handle Excel serial number (integers)
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
      const excelSerial = Number(value);
      if (excelSerial > 0) {
        const date = new Date((excelSerial - 1) * 86400000 + new Date(1900, 0, 1).getTime());
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    if (typeof value === 'string' && value.includes('T')) {
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    if (typeof value === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      return value;
    }
    return String(value);
  } catch {
    return String(value);
  }
};

const IMAGE_BASE_URL = "/uploads/";

const getStatusColor = (value: string, type: string) => {
  const v = String(value).toLowerCase().trim();

  if (type === 'dl_idl') {
    if (v === 'dl') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800';
    if (v === 'idl') return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800';
    if (v === 'staff') return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800';
    return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }

  if (type === 'status') {
    if (v.includes('active')) return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800';
    if (v.includes('resign')) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800';
    if (v.includes('maternity')) return 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-800';
    return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }

  if (type === 'emp_type') {
    if (v.includes('official')) return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800';
    if (v.includes('probation')) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800';
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }

  return 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
};

const formatDateToISO = (value: string): string => {
  if (!value) return "";
  try {
    if (value.includes('T')) return value;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toISOString();
    }
    return value;
  } catch {
    return value;
  }
};

interface SheetManagerProps {
  initialShowApprovalOnly?: boolean;
  enableApproval?: boolean;
  enableDeleteAll?: boolean;
  enableAddEntry?: boolean;
}

const SheetManager = ({
  initialShowApprovalOnly = false,
  enableApproval = true,
  enableDeleteAll = true,
  enableAddEntry = true
}: SheetManagerProps) => {

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // UI state
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [originalRows, setOriginalRows] = useState<SheetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [debouncedFilters, setDebouncedFilters] = useState<{ [key: string]: string }>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [modifiedRows, setModifiedRows] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showApprovalOnly, setShowApprovalOnly] = useState(initialShowApprovalOnly);

  // Image upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState<number>(Date.now());

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'approve' | 'reject' | null;
    count: number;
  }>({ show: false, type: null, count: 0 });

  // Handle Image Upload
  const handleAvatarClick = (e: React.MouseEvent, rowId: string) => {
    e.stopPropagation(); // Prevent cell edit
    if (saving) return; // Prevent concurrent actions
    setUploadingRowId(rowId);
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingRowId) return;

    // Find row to get Emp ID
    const row = rows.find(r => r.id === uploadingRowId);
    const empId = row?.["Emp ID"];

    if (!empId) {
      setError("Cannot upload image: Employee ID not found.");
      return;
    }

    setSaving(true);
    setSuccessMessage("Processing and uploading image...");

    try {
      // 1. Resize and Convert to WebP using Canvas
      const imageBitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error("Canvas context failed");

      // Target dimensions
      const targetWidth = 225;
      const targetHeight = 300;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw and resize (stretch to fit or crop?)
      // Requirement says "resize to 225 x 300". Usually simple resizing.
      // If we want maintain aspect ratio we need more logic, but "resize" implies exact match.
      ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

      // Convert to blob (webp)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.9) // 0.9 quality
      );

      if (!blob) throw new Error("Image conversion failed");

      // 2. Prepare Upload
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("filename", empId); // Name is Emp ID

      // 3. Upload via API
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage("✅ Image updated successfully");
        setImageVersion(Date.now()); // Force refresh images
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || "Failed to upload image");
      }

    } catch (err: any) {
      console.error("Upload error:", err);
      setError("Error processing image: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
      setUploadingRowId(null);
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
    }
  };

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [filters]);

  // ======= SERVER-SIDE PAGINATION WITH SWR =======
  const queryParams = new URLSearchParams();
  queryParams.set('page', currentPage.toString());
  queryParams.set('limit', ITEMS_PER_PAGE.toString());

  if (showApprovalOnly) {
    queryParams.set('lineManagerStatus', 'pending');
  }

  Object.entries(debouncedFilters).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      queryParams.set(key, value.trim());
    }
  });

  const apiUrl = `/api/sheet?${queryParams.toString()}`;

  const { data: apiResult, error: swrError, mutate, isLoading, isValidating } = useSWR(
    apiUrl,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      revalidateIfStale: true,
      keepPreviousData: true,
    }
  );

  const nextQueryParams = new URLSearchParams(queryParams);
  nextQueryParams.set('page', (currentPage + 1).toString());
  const nextPageUrl = `/api/sheet?${nextQueryParams.toString()}`;

  useSWR(
    apiResult?.totalPages && currentPage < apiResult.totalPages ? nextPageUrl : null,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
      revalidateIfStale: false,
    }
  );

  const totalRecords = apiResult?.total || 0;
  const totalPages = apiResult?.totalPages || 1;

  // Sync API data to local state
  useEffect(() => {
    if (apiResult?.success && modifiedRows.size === 0) {
      startTransition(() => {
        const apiHeaders = apiResult.headers || [];
        const visibleHeaders = apiHeaders.filter((h: string) =>
          VISIBLE_COLUMNS.includes(h) || VISIBLE_COLUMNS.includes(denormalizeFieldName(h))
        );

        if (visibleHeaders.length === 0 && apiResult.data?.length > 0) {
          const firstRow = apiResult.data[0];
          const inferredHeaders = Object.keys(firstRow).filter(h =>
            VISIBLE_COLUMNS.includes(h) || VISIBLE_COLUMNS.includes(denormalizeFieldName(h))
          );
          setHeaders(inferredHeaders.length > 0 ? inferredHeaders : VISIBLE_COLUMNS);
        } else {
          setHeaders(visibleHeaders.length > 0 ? visibleHeaders : VISIBLE_COLUMNS);
        }

        setRows(apiResult.data || []);

        requestIdleCallback?.(() => {
          setOriginalRows(structuredClone?.(apiResult.data || []) || JSON.parse(JSON.stringify(apiResult.data || [])));
        }) ?? setTimeout(() => {
          setOriginalRows(structuredClone?.(apiResult.data || []) || JSON.parse(JSON.stringify(apiResult.data || [])));
        }, 0);
      });
    } else if (apiResult?.error) {
      setError(apiResult.error);
    }
  }, [apiResult, modifiedRows.size]);

  useEffect(() => {
    if (swrError) {
      setError(swrError.message || "Network error");
    }
  }, [swrError]);

  const filteredRows = useMemo(() => {
    return rows;
  }, [rows]);

  const pendingApprovals = useMemo(() => {
    return rows.filter(row => row.lineManagerStatus === 'pending');
  }, [rows]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleFilterChange = (header: string, value: string) => {
    setFilters((prev) => ({ ...prev, [header]: value }));
  };

  const handleCellClick = (rowId: string, header: string) => {
    setEditingCell({ rowId, header });
  };

  const handleCellChange = (rowId: string, header: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [header]: value } : row))
    );
    setModifiedRows((prev) => new Set([...prev, rowId]));
  };

  const handleAddRow = () => {
    setShowAddModal(true);
  };

  const handleSaveNewEmployee = async (formData: any): Promise<boolean> => {
    try {
      const dataToSave: any = {};
      Object.keys(formData).forEach(key => {
        let value = formData[key] || "";
        if (DATE_COLUMNS.includes(key) && value) {
          if (/\d{4}-\d{2}-\d{2}/.test(value)) {
            dataToSave[normalizeFieldName(key)] = new Date(value).toISOString();
          } else {
            dataToSave[normalizeFieldName(key)] = value;
          }
        } else {
          dataToSave[normalizeFieldName(key)] = value;
        }
      });

      const response = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", data: dataToSave })
      });

      const result = await response.json();

      if (result.success) {
        const newEmpId = formData["Emp ID"];
        setSuccessMessage("✅ New employee added successfully");
        await mutate();
        setTimeout(() => setSuccessMessage(null), 3000);
        return true;
      } else {
        setError(result.error || "Failed to create employee");
        return false;
      }
    } catch (err) {
      console.error(err);
      setError("Network error while adding employee");
      return false;
    }
  };

  const handleSaveAll = async () => {
    if (modifiedRows.size === 0) return;
    setSaving(true);
    setError(null);
    let successCount = 0;

    try {
      for (const rowId of modifiedRows) {
        const row = rows.find((r) => r.id === rowId);
        const originalRow = originalRows.find((r) => r.id === rowId);
        if (!row || !originalRow) continue;

        const dataToSave: { [key: string]: any } = {};

        headers.forEach((header) => {
          let value = row[header] || "";
          let originalValue = originalRow[header] || "";

          if (DATE_COLUMNS.includes(header)) {
            value = formatDateToISO(value);
            originalValue = formatDateToISO(originalValue);
          }

          const normalizedHeader = normalizeFieldName(header);

          if (isLineManagerCol(header) && value !== originalValue) {
            dataToSave["pendingLineManager"] = value;
            dataToSave["lineManagerStatus"] = "pending";
          } else {
            dataToSave[normalizedHeader] = value;
          }
        });

        // Add requester info if line manager is being updated to pending
        if (dataToSave["lineManagerStatus"] === "pending") {
          try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
              const user = JSON.parse(userStr);
              dataToSave["requester"] = user.username || user.full_name || "Unknown";
            }
          } catch (e) {
            console.error("Failed to get user info", e);
          }
        }

        const response = await fetch("/api/sheet", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rowId, data: dataToSave }),
        });
        const result = await response.json();
        if (result.success) successCount++;
      }

      setSuccessMessage(`Successfully updated ${successCount} records.`);
      setModifiedRows(new Set());
      await mutate();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalAction = async (rowId: string, action: 'approve' | 'reject') => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    setSaving(true);
    try {
      const dataToUpdate: any = {};
      if (action === 'approve') {
        const lmHeader = headers.find(isLineManagerCol) || "Line Manager";
        dataToUpdate[normalizeFieldName(lmHeader)] = row.pendingLineManager;
        dataToUpdate["lineManagerStatus"] = "approved";
        dataToUpdate["pendingLineManager"] = null;
        dataToUpdate["requester"] = null;
      } else {
        dataToUpdate["lineManagerStatus"] = "rejected";
        dataToUpdate["pendingLineManager"] = null;
        dataToUpdate["requester"] = null;
      }

      const response = await fetch("/api/sheet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, data: dataToUpdate }),
      });

      const result = await response.json();
      if (result.success) {
        setSuccessMessage(action === 'approve' ? "Changes approved." : "Request rejected.");
        await mutate();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError("Approval error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (rowId: string, empName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${empName}"?`)) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/sheet?id=${rowId}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.success) {
        setSuccessMessage(`Deleted "${empName}" successfully.`);
        await mutate();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || "Failed to delete");
      }
    } catch (err) {
      setError("Error deleting employee");
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAll = async () => {
    console.log('handleRejectAll called, totalRecords:', totalRecords);
    const pendingCount = totalRecords;
    if (pendingCount === 0) {
      setError("No pending requests to reject.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    // Show confirm modal instead of window.confirm
    setConfirmModal({ show: true, type: 'reject', count: pendingCount });
  };

  const executeRejectAll = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rejectAll", data: {} }),
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(`✓ Rejected ${result.count} requests.`);
        await mutate();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Error rejecting all.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAll = async () => {
    console.log('handleApproveAll called, totalRecords:', totalRecords);
    const pendingCount = totalRecords;
    if (pendingCount === 0) {
      setError("No pending requests to approve.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    // Show confirm modal instead of window.confirm
    setConfirmModal({ show: true, type: 'approve', count: pendingCount });
  };

  const executeApproveAll = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approveAll", data: {} }),
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(`✓ Approved ${result.count} requests.`);
        await mutate();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Error approving all.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAction = async () => {
    setConfirmModal({ show: false, type: null, count: 0 });
    if (confirmModal.type === 'approve') {
      await executeApproveAll();
    } else if (confirmModal.type === 'reject') {
      await executeRejectAll();
    }
  };

  const handleDeleteAll = async () => {
    const firstConfirm = window.confirm(
      `⚠️ DANGER: DELETE ALL ${totalRecords} employees?\n\nThis is IRREVERSIBLE.`
    );
    if (!firstConfirm) return;

    const userInput = window.prompt(`Type "DELETE" to confirm:`);
    if (userInput !== "DELETE") return;

    setSaving(true);
    try {
      const response = await fetch("/api/sheet?deleteAll=true", { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(`🗑️ Deleted all ${result.count} employees.`);
        setCurrentPage(1);
        await mutate();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Error deleting all data.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && rows.length === 0) {
    return (
      <div className={styles.spinner}>
        <ArrowPathIcon className="w-12 h-12 text-[#DB011C] animate-spin mx-auto mb-4" />
        <span>Loading page {currentPage}...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className="flex items-center gap-4">
          <ShieldCheckIcon className="w-8 h-8 text-[#DB011C]" />
          <h1>Milwaukee Tool HR Registry</h1>
          {isValidating && (
            <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Show pending count badge when in approval mode */}
          {enableApproval && showApprovalOnly && pendingApprovals.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <ClockIcon className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {pendingApprovals.length} Pending Changes
              </span>
            </div>
          )}

          {enableAddEntry && (
            <>
              <button onClick={handleAddRow} className={styles.btnCreate}>
                <PlusIcon className="w-4 h-4 inline mr-1" />
                Add Entry
              </button>

              <button
                onClick={handleSaveAll}
                disabled={saving || modifiedRows.size === 0}
                className={styles.btnSaveAll}
              >
                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin inline mr-1" /> : <ArrowDownTrayIcon className="w-4 h-4 inline mr-1" />}
                Save ({modifiedRows.size})
              </button>
            </>
          )}



          {showApprovalOnly && totalRecords > 0 && (
            <>
              <button
                onClick={handleApproveAll}
                disabled={saving}
                className={`${styles.btnReset} flex items-center gap-2`}
                style={{ backgroundColor: '#22c55e' }}
              >
                <CheckCircleIcon className="w-4 h-4" />
                Approve All ({totalRecords})
              </button>
              <button
                onClick={handleRejectAll}
                disabled={saving}
                className={`${styles.btnReset} flex items-center gap-2`}
                style={{ backgroundColor: '#f97316' }}
              >
                <NoSymbolIcon className="w-4 h-4" />
                Reject All ({totalRecords})
              </button>
            </>
          )}

          {enableDeleteAll && (
            <button
              onClick={handleDeleteAll}
              disabled={saving || totalRecords === 0}
              className={`${styles.btnReset} flex items-center gap-2`}
              style={{ backgroundColor: '#dc2626' }}
            >
              <TrashIcon className="w-4 h-4" />
              Delete All
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {error && (
          <div className={styles.error}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)}><XMarkIcon className="w-5 h-5" /></button>
            </div>
          </div>
        )}
        {successMessage && (
          <div className={styles.successMessage}>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        <div className={styles.filterBox}>
          <div className={styles.filterRow}>
            {FILTER_COLUMNS.map((header) => {
              const isDLType = header === "DL/IDL/Staff";
              return (
                <div key={header} className={styles.filterInputWrapper}>
                  <label className={styles.filterLabel}>{header.replace(/\r\n/g, ' ')}</label>
                  {isDLType ? (
                    <select
                      value={filters[header] || ""}
                      onChange={(e) => handleFilterChange(header, e.target.value)}
                      className={styles.filterInput}
                    >
                      <option value="">All</option>
                      <option value="DL">DL</option>
                      <option value="IDL">IDL</option>
                      <option value="Staff">Staff</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={`Search...`}
                      value={filters[header] || ""}
                      onChange={(e) => handleFilterChange(header, e.target.value)}
                      className={styles.filterInput}
                    />
                  )}
                </div>
              );
            })}
            <div className="flex items-end">
              <button
                onClick={() => { setFilters({}); }}
                className={styles.btnReset}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header.replace(/\r\n/g, ' ')}</th>
                ))}
                <th className="w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className={modifiedRows.has(row.id) ? styles.modified : ''}>
                  {headers.map((header) => {
                    const isEditing = editingCell?.rowId === row.id && editingCell?.header === header;
                    const isLM = isLineManagerCol(header);
                    const isPending = isLM && row.lineManagerStatus === 'pending';

                    return (
                      <td
                        key={`${row.id}-${header}`}
                        onClick={() => handleCellClick(row.id, header)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={String(row[header] || "")}
                            onChange={(e) => handleCellChange(row.id, header, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null); }}
                            className={styles.cellInput}
                          />
                        ) : (
                          <div className={`flex items-center gap-3 min-h-[40px] ${styles.cellContent}`}>
                            {/* Avatar for FullName */}
                            {header === "FullName " && (
                              <div
                                className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-page)] shadow-sm relative group cursor-pointer"
                                onClick={(e) => handleAvatarClick(e, row.id)}
                                title="Click to change photo"
                              >
                                <img
                                  src={`${IMAGE_BASE_URL}${row["Emp ID"]}.webp?v=${imageVersion}`}
                                  alt=""
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(row["FullName "] || "User")}&background=random&color=fff&size=64`;
                                  }}
                                />
                                {/* Hover overlay icon */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                                  <ArrowPathIcon className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}

                            {/* Cell Content */}
                            <div className="flex-grow">
                              {(header === "DL/IDL/Staff" || header === "Employee\r\n Type" || header === "Status") ? (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-sm ${header === "DL/IDL/Staff" ? getStatusColor(row[header], 'dl_idl') :
                                  header === "Employee\r\n Type" ? getStatusColor(row[header], 'emp_type') :
                                    getStatusColor(row[header], 'status')
                                  }`}>
                                  {String(row[header] || "")}
                                </span>
                              ) : (
                                <span className={`block truncate ${header === "FullName " ? "font-semibold text-[var(--color-text-title)]" : ""}`}>
                                  {DATE_COLUMNS.includes(header) ? formatDate(row[header]) : String(row[header] || "")}
                                </span>
                              )}

                              {/* Pending Review Info */}
                              {isPending && (
                                <div className="mt-1 p-1 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-100 dark:border-amber-800 inline-block">
                                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                                    <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                    → {row.pendingLineManager}
                                  </span>
                                  {row.requester && (
                                    <span className="text-[9px] text-[var(--color-text-muted)] italic block mt-0.5 px-0.5">
                                      by {row.requester}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                        }
                      </td>
                    );
                  })}
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {showApprovalOnly && (
                        <>
                          <button
                            onClick={() => handleApprovalAction(row.id, 'approve')}
                            disabled={saving}
                            className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/50 rounded"
                            title="Approve"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApprovalAction(row.id, 'reject')}
                            disabled={saving}
                            className="p-1 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/50 rounded"
                            title="Reject"
                          >
                            <NoSymbolIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRow(row.id, row['FullName '] || row.id);
                        }}
                        disabled={saving}
                        className="p-1.5 text-gray-400 dark:text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition-colors"
                        title="Delete Employee"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={headers.length + 1} className="text-center py-8 text-[var(--color-text-muted)]">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <div className="flex items-center justify-between px-4">
            <div className={styles.toolbarInfo}>
              Showing <strong>{filteredRows.length}</strong> of <strong>{ITEMS_PER_PAGE}</strong> per page
              {totalRecords > 0 && <span className="ml-2 text-[var(--color-text-muted)]">({totalRecords} total)</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 border border-[var(--color-border)] rounded disabled:opacity-30 hover:bg-[var(--color-bg-page)] text-[var(--color-text-body)]"
              >
                <ChevronDoubleLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 border border-[var(--color-border)] rounded disabled:opacity-30 hover:bg-[var(--color-bg-page)] text-[var(--color-text-body)]"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 bg-[var(--color-bg-page)] rounded font-medium text-[var(--color-text-body)] border border-[var(--color-border)]">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 border border-[var(--color-border)] rounded disabled:opacity-30 hover:bg-[var(--color-bg-page)] text-[var(--color-text-body)]"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1.5 border border-[var(--color-border)] rounded disabled:opacity-30 hover:bg-[var(--color-bg-page)] text-[var(--color-text-body)]"
              >
                <ChevronDoubleRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal for Approve All / Reject All */}
      {
        confirmModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-bg-card)] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200 border border-[var(--color-border)]">
              <div className="flex items-center gap-3 mb-4">
                {confirmModal.type === 'approve' ? (
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircleIcon className="w-6 h-6 text-green-600" />
                  </div>
                ) : (
                  <div className="p-3 bg-orange-100 rounded-full">
                    <NoSymbolIcon className="w-6 h-6 text-orange-600" />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-[var(--color-text-title)]">
                  {confirmModal.type === 'approve' ? 'Approve All Changes' : 'Reject All Changes'}
                </h3>
              </div>

              <p className="text-[var(--color-text-muted)] mb-6">
                {confirmModal.type === 'approve'
                  ? `Are you sure you want to approve all ${confirmModal.count} pending changes? This will apply the new Line Manager values.`
                  : `Are you sure you want to reject all ${confirmModal.count} pending changes? The original Line Manager values will be kept.`
                }
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmModal({ show: false, type: null, count: 0 })}
                  className="px-4 py-2 text-[var(--color-text-body)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-page)] rounded-lg transition-colors border border-[var(--color-border)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={saving}
                  className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${confirmModal.type === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                >
                  {saving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                  {confirmModal.type === 'approve' ? 'Yes, Approve All' : 'Yes, Reject All'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      <SheetAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveNewEmployee}
        columns={ADD_FORM_COLUMNS}
      />
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />
    </div>
  );
};

export default SheetManager;