"use client";

import { useState, useRef } from "react";
import {
    CloudArrowUpIcon,
    DocumentIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    PhotoIcon,
    TableCellsIcon
} from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabase";

type ImportTab = 'excel' | 'images';

interface DataImportProps {
    mode?: 'excel' | 'images' | 'both';
}

export default function DataImport({ mode = 'both' }: DataImportProps) {
    const [activeTab, setActiveTab] = useState<ImportTab>(mode === 'excel' ? 'excel' : mode === 'images' ? 'images' : 'excel');

    // Excel State
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Image State
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imageLogs, setImageLogs] = useState<{ name: string; status: 'pending' | 'success' | 'error'; message?: string }[]>([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // --- Excel Handlers ---
    const handleFileChange = (selectedFile: File | null) => {
        if (selectedFile && (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls"))) {
            setFile(selectedFile);
            setError(null);
            setSuccess(null);
            setImportResult(null);
        } else {
            setError("Please select a valid Excel file (.xlsx)");
            setFile(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/import_excel", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Upload failed");
            }

            setSuccess("Import successful!");
            setImportResult(data);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Image Handlers ---
    const handleImageFilesChange = (files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

        // Initial validation logs
        const initialLogs = newFiles.map(f => {
            // Updated Regex: Match all digits including leading zeros (e.g., 000818)
            const match = f.name.match(/^(\d+)/);
            const isValidName = !!match;

            return {
                name: f.name,
                status: isValidName ? 'pending' as const : 'error' as const,
                message: isValidName
                    ? `Ready (ID: ${match ? match[1] : ''})`
                    : 'Invalid format. Name must start with Employee ID.'
            };
        });

        setImageFiles(newFiles);
        setImageLogs(initialLogs);
    };

    const processAndUploadImage = async (file: File, index: number) => {
        return new Promise<void>(async (resolve) => {
            // Extract ID from filename again
            const match = file.name.match(/^(\d+)/);

            // Re-validate just in case
            if (!match) {
                setImageLogs(prev => {
                    const newLogs = [...prev];
                    newLogs[index] = { ...newLogs[index], status: 'error', message: 'Invalid ID format' };
                    return newLogs;
                });
                resolve();
                return;
            }

            // Normalize ID: Remove leading zeros to match the API (e.g., "000818" -> "818")
            const employeeId = match[1].replace(/^0+/, '') || '0';

            try {
                // 1. Resize and Convert to WebP
                const imageBitmap = await createImageBitmap(file);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) throw new Error("Canvas context failed");

                canvas.width = 225;
                canvas.height = 300;

                // Draw image containing (cover or contain? User didn't specify, but usually 'contain' or 'fill' for ID photos. 
                // Given fixed size 225x300, let's assume simple drawImage to fill, possibly stretching if ratio off, 
                // or better: preserve aspect ratio and center crop (cover).
                // For simplicity and standard ID photo requirements, let's stretch to fit (simple draw) as it guarantees 225x300. 
                // OR better: Draw Cover.
                // Let's implement 'Cover' style to avoid distortion.

                const ratio = Math.max(225 / imageBitmap.width, 300 / imageBitmap.height);
                const centerShift_x = (225 - imageBitmap.width * ratio) / 2;
                const centerShift_y = (300 - imageBitmap.height * ratio) / 2;

                ctx.drawImage(
                    imageBitmap, 0, 0, imageBitmap.width, imageBitmap.height,
                    centerShift_x, centerShift_y, imageBitmap.width * ratio, imageBitmap.height * ratio
                );

                // Convert to Blob
                const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', 0.9));
                if (!blob) throw new Error("WebP conversion failed");

                // 2. Upload to Supabase
                // Bucket: 'employee_images'
                // Filename: ID.webp
                const fileName = `${employeeId}.webp`;

                // 2. Upload via API (to bypass RLS)
                const formData = new FormData();
                formData.append('file', blob, fileName);
                formData.append('filename', fileName);

                const response = await fetch('/api/admin/upload-employee-image', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || "Upload failed");
                }

                setImageLogs(prev => {
                    const newLogs = [...prev];
                    newLogs[index] = { ...newLogs[index], status: 'success', message: 'Uploaded' };
                    return newLogs;
                });

            } catch (err: any) {
                console.error(err);
                setImageLogs(prev => {
                    const newLogs = [...prev];
                    newLogs[index] = { ...newLogs[index], status: 'error', message: err.message || "Upload failed" };
                    return newLogs;
                });
            } finally {
                resolve();
            }
        });
    };

    const handleBatchUpload = async () => {
        setUploadingImages(true);
        const validFiles = imageFiles.map((f, i) => ({ file: f, index: i }))
            .filter(({ index }) => imageLogs[index].status !== 'error');

        // Process sequentially or limited parallel to avoid browser hanging
        for (const { file, index } of validFiles) {
            setImageLogs(prev => {
                const newLogs = [...prev];
                newLogs[index] = { ...newLogs[index], message: 'Processing...' };
                return newLogs;
            });
            await processAndUploadImage(file, index);
        }
        setUploadingImages(false);
    };

    return (
        <div className="h-full bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col p-6">

            {/* Tabs */}
            {mode === 'both' && (
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setActiveTab('excel')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'excel'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <TableCellsIcon className="w-5 h-5" />
                        Excel Data
                    </button>
                    <button
                        onClick={() => setActiveTab('images')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'images'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <PhotoIcon className="w-5 h-5" />
                        Employee Images
                    </button>
                </div>
            )}

            {/* EXCEL TAB */}
            {activeTab === 'excel' && (
                <div className="max-w-md w-full mx-auto flex flex-col items-center">
                    <div className="text-center mb-8">
                        <h2 className="text-xl font-bold text-gray-900">Import Organization Data</h2>
                        <p className="text-sm text-gray-500 mt-1">Upload your Excel file to update the database</p>
                    </div>

                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            handleFileChange(e.dataTransfer.files[0]);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            w-full relative group cursor-pointer
                            border-2 border-dashed rounded-xl p-8 transition-all duration-200
                            flex flex-col items-center justify-center gap-4
                            ${isDragging
                                ? "border-blue-500 bg-blue-50/50"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                            }
                        `}
                    >
                        <div className={`
                            p-4 rounded-full transition-colors duration-200
                            ${isDragging ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400 group-hover:text-gray-600"}
                        `}>
                            <CloudArrowUpIcon className="w-8 h-8" />
                        </div>

                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-900 border-b-2 border-transparent group-hover:border-blue-500 inline-block">
                                Click to upload Excel
                            </p>
                            <span className="text-sm text-gray-500"> or drag and drop</span>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                    </div>

                    {/* Status Area Excel */}
                    <div className="mt-6 space-y-4 w-full">
                        {file && (
                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                <DocumentIcon className="w-5 h-5 text-blue-600" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-blue-900 truncate">{file.name}</p>
                                    <p className="text-xs text-blue-600">{(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                                <button onClick={() => setFile(null)} className="text-blue-400 hover:text-blue-600">×</button>
                            </div>
                        )}
                        {error && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                                <ExclamationCircleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}
                        {success && (
                            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                                <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-green-800">
                                    <p className="font-medium">{success}</p>
                                    {importResult?.total && <p className="mt-1">Processed {importResult.total} records.</p>}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? "Importing..." : "Start Import"}
                        </button>
                    </div>
                </div>
            )}

            {/* IMAGE TAB */}
            {activeTab === 'images' && (
                <div className="w-full h-full flex flex-col">
                    <div className="flex-1 flex flex-col items-center max-w-2xl mx-auto w-full">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Import Employee Photos</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Files must be named with Employee ID (e.g. <code>818.jpg</code>).
                                <br />
                                Images will be resized to 225x300 and converted to WebP.
                            </p>
                        </div>

                        {imageFiles.length === 0 ? (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    handleImageFilesChange(e.dataTransfer.files);
                                }}
                                onClick={() => imageInputRef.current?.click()}
                                className={`
                                    w-full h-48 border-2 border-dashed rounded-xl cursor-pointer flex flex-col items-center justify-center gap-3 transition-colors
                                    ${isDragging
                                        ? "border-blue-500 bg-blue-50/50"
                                        : "border-gray-300 hover:bg-gray-50"
                                    }
                                `}
                            >
                                <div className={`p-3 rounded-full ${isDragging ? "bg-blue-100 text-blue-600" : "bg-blue-50 text-blue-600"}`}>
                                    <PhotoIcon className="w-8 h-8" />
                                </div>
                                <p className="text-sm font-medium text-gray-900">Click to select images</p>
                                <p className="text-xs text-gray-500">or drag and drop here</p>
                                <p className="text-xs text-gray-400">Supports JPG, PNG, WEBP</p>
                            </div>
                        ) : (
                            <div className="w-full flex-1 flex flex-col min-h-0 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                <div className="p-3 border-b border-gray-200 bg-white flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-700">{imageFiles.length} files selected</span>
                                    <button
                                        onClick={() => { setImageFiles([]); setImageLogs([]); }}
                                        disabled={uploadingImages}
                                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {imageLogs.map((log, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded border border-gray-100 shadow-sm">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'success' ? 'bg-green-500' :
                                                log.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                                                }`} />
                                            <span className="text-sm font-mono text-gray-700 flex-1 truncate">{log.name}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${log.status === 'success' ? 'bg-green-100 text-green-700' :
                                                log.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="w-full mt-4">
                            <input
                                ref={imageInputRef}
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleImageFilesChange(e.target.files)}
                                className="hidden"
                            />

                            {imageFiles.length > 0 && (
                                <button
                                    onClick={handleBatchUpload}
                                    disabled={uploadingImages}
                                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                                >
                                    {uploadingImages ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Processing {imageFiles.length} images...
                                        </>
                                    ) : (
                                        `Upload ${imageFiles.filter((_, i) => imageLogs[i].status !== 'error' && imageLogs[i].status !== 'success').length} Valid Images`
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
