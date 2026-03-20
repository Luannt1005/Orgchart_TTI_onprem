/**
 * Custom Hook: useSheetData
 * Fetches organization data from /api/sheet (Firestore)
 * Maps raw sheet data to OrgNode structure
 */

'use client';

import { useMemo } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { OrgNode, ApiResponse } from '@/types/orgchart';
import { swrFetcher } from '@/lib/api-client';

const SHEET_API_URL = '/api/sheet';

interface UseSheetDataOptions extends SWRConfiguration {
    onSuccess?: (data: OrgNode[]) => void;
    onError?: (error: Error) => void;
}

// ===============================
// Transformer
// ===============================
function transformSheetData(rawData: any[]): OrgNode[] {
    if (!Array.isArray(rawData)) return [];

    return rawData.map((row) => {
        const id = row['Emp ID'] || row['Employee ID'] || row['id'] || row['ID'];
        const pid = row['Manager ID'] || row['Supervisor ID'] || row['Line Manager'] || row['pid'] || row['PID'];
        const name = row['FullName '] || row['FullName'] || row['Employee Name'] || row['Name'] || row['Full Name'] || row['name'];
        const title = row['Job Title'] || row['Title'] || row['Position'] || row['title'];
        const dept = row['Dept'] || row['Department'] || row['dept'];
        const img = row['Photo'] || row['Image'] || row['img'] || row['Avatar'];

        return {
            ...row,
            id: id ? normalizeId(id) : `unknown-${Math.random()}`,
            pid: pid ? normalizeId(pid) : '',
            name: name || 'Unknown',
            title: title || '',
            dept: dept || '',
            img: img || '',
            tags: [dept]
        } as OrgNode;
    });
}

// ===============================
// Hook
// ===============================
export function useSheetData(options?: UseSheetDataOptions) {
    const { data, error, isLoading, mutate } = useSWR(
        SHEET_API_URL,
        swrFetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,
            revalidateOnMount: true,
            dedupingInterval: 15 * 60 * 1000, // 15 minutes - keep cache active
            focusThrottleInterval: 15 * 60 * 1000, // 15 minutes
            ...options
        }
    );

    const rawNodes = data?.data || [];

    const nodes = useMemo(() => transformSheetData(rawNodes), [rawNodes]);

    const groups = useMemo(
        () => Array.from(new Set(nodes.map(n => n.dept).filter(Boolean))).sort(),
        [nodes]
    );

    return {
        nodes,
        groups,
        loading: isLoading,
        error: error as Error | null,
        mutate,
        rawData: data
    };
}

// ===============================
// Helpers (FIXED)
// ===============================

/** Normalize ID: remove leading zeros */
function normalizeId(value: string | number): string {
    return String(value)
        .trim()
        .replace(/^0+/, '');
}

/** Extract pure ID from pid (handle "000818", "818: Name", "000818 Name") */
function extractPidId(pid: string | number): string {
    return normalizeId(
        String(pid)
            .trim()
            .split(/[:\s]/)[0]
    );
}

/**
 * Get all subordinates of a manager (recursive, safe)
 */
export function getSubordinatesRecursive(
    nodes: OrgNode[],
    managerId: string | number,
    visited = new Set<string>()
): OrgNode[] {
    if (!managerId) return [];

    const managerKey = normalizeId(managerId);

    // Prevent infinite loop
    if (visited.has(managerKey)) return [];
    visited.add(managerKey);

    const directReports = nodes.filter(node => {
        if (!node.pid) return false;
        return extractPidId(node.pid) === managerKey;
    });

    const allReports: OrgNode[] = [];

    for (const report of directReports) {
        const reportKey = normalizeId(report.id);

        if (!visited.has(reportKey)) {
            allReports.push(report);
            allReports.push(
                ...getSubordinatesRecursive(nodes, report.id, visited)
            );
        }
    }

    return allReports;
}
