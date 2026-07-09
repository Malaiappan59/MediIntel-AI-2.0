"use client";

import { createContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { applySettingsToDataset } from "@/lib/experience";
import { buildDashboardMetrics, buildProcurementActivity } from "@/lib/mock-data";
import { readStoredSettingsRecord, writeStoredSettingsRecord } from "@/lib/settings-storage";
import {
  createApiDefinition,
  createEmptyDataset,
  createMemoryFile,
  deleteApiDefinition,
  deleteMemoryFile,
  generateProcurementRequest as generateProcurementRequestApi,
  launchMasterAgent as launchMasterAgentRequest,
  loadDataset,
  resolveAlert as resolveAlertRequest,
  sendChatMessage as sendChatMessageRequest,
  updateOrderReviewStatus,
} from "@/services/medintel-service";
import type {
  ActivityItem,
  ApiDefinition,
  ChatMessage,
  DashboardMetric,
  MasterAgentExecution,
  MediIntelDataset,
  MemoryFile,
  ProcurementOrder,
  SettingsState,
} from "@/types/medintel";

type UploadFilePayload = {
  filename: string;
  category: string;
  sizeLabel: string;
  content: string;
  file?: File;
};

type CreateApiPayload = {
  name: string;
  endpoint: string;
  method: ApiDefinition["method"];
  authentication: string;
  description: string;
};

type GenerateProcurementPayload = {
  medicineId?: string;
  quantity?: number;
  note?: string;
};

type ReviewOrderStatus = Extract<ProcurementOrder["status"], "approved" | "rejected" | "modified">;

type AppDataContextValue = {
  dataset: MediIntelDataset;
  dashboardMetrics: DashboardMetric[];
  procurementActivity: ActivityItem[];
  activeExecution: MasterAgentExecution | null;
  loadError: string | null;
  settingsSavedAt: string | null;
  addFile: (payload: UploadFilePayload) => Promise<MemoryFile>;
  addFiles: (payloads: UploadFilePayload[]) => Promise<MemoryFile[]>;
  deleteFile: (fileId: string) => Promise<string>;
  deleteFiles: (fileIds: string[]) => Promise<string[]>;
  resolveAlert: (alertId: string) => Promise<void>;
  resolveAlerts: (alertIds: string[]) => Promise<void>;
  addApi: (payload: CreateApiPayload) => Promise<void>;
  deleteApi: (apiId: string) => Promise<void>;
  updateSettings: (settings: SettingsState) => void;
  sendChatMessage: (message: string) => Promise<ChatMessage>;
  launchMasterAgent: (goal?: string) => Promise<MasterAgentExecution>;
  generateProcurementRequest: (payload?: GenerateProcurementPayload) => Promise<ProcurementOrder>;
  updateOrderStatus: (orderId: string, status: ReviewOrderStatus) => Promise<void>;
  updateOrderStatuses: (orderIds: string[], status: ReviewOrderStatus) => Promise<void>;
};

export const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { username, role, isAuthenticated } = useAuth();
  const [dataset, setDataset] = useState<MediIntelDataset>(createEmptyDataset(username ?? undefined, role ?? undefined));
  const [activeExecution, setActiveExecution] = useState<MasterAgentExecution | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<string | null>(null);

  const profileName = username ?? "Operations Lead";
  const profileRole = role ?? "Admin";
  const settingsStorageUser = username ?? null;

  const withWorkspaceSettings = (sourceDataset: MediIntelDataset) => {
    const storedRecord = readStoredSettingsRecord(settingsStorageUser);
    const settings = storedRecord?.settings ?? sourceDataset.settings;

    return {
      dataset: applySettingsToDataset(sourceDataset, settings, profileName, profileRole),
      settingsSavedAt: storedRecord?.updatedAt ?? null,
    };
  };

  const reloadDataset = async () => {
    if (!isAuthenticated) {
      setDataset(createEmptyDataset(profileName, profileRole));
      setActiveExecution(null);
      setLoadError(null);
      setSettingsSavedAt(null);
      return;
    }

    try {
      const nextDataset = await loadDataset(profileName, profileRole);
      const hydrated = withWorkspaceSettings(nextDataset);
      setDataset(hydrated.dataset);
      setLoadError(null);
      setSettingsSavedAt(hydrated.settingsSavedAt);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "MediIntel could not load live backend data.");
    }
  };

  useEffect(() => {
    void reloadDataset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, profileName, profileRole]);

  const addFile = async (payload: UploadFilePayload) => {
    const created = await createMemoryFile(payload);
    await reloadDataset();
    return created;
  };

  const addFiles = async (payloads: UploadFilePayload[]) => {
    const createdFiles: MemoryFile[] = [];

    for (const payload of payloads) {
      createdFiles.push(await createMemoryFile(payload));
    }

    await reloadDataset();
    return createdFiles;
  };

  const deleteFile = async (fileId: string) => {
    await deleteMemoryFile(fileId);
    await reloadDataset();
    return fileId;
  };

  const deleteFiles = async (fileIds: string[]) => {
    const uniqueIds = Array.from(new Set(fileIds.filter(Boolean)));

    if (!uniqueIds.length) {
      return [];
    }

    for (const fileId of uniqueIds) {
      await deleteMemoryFile(fileId);
    }

    await reloadDataset();
    return uniqueIds;
  };

  const resolveAlert = async (alertId: string) => {
    await resolveAlertRequest(alertId);
    await reloadDataset();
  };

  const resolveAlerts = async (alertIds: string[]) => {
    const uniqueIds = Array.from(new Set(alertIds.filter(Boolean)));

    if (!uniqueIds.length) {
      return;
    }

    for (const alertId of uniqueIds) {
      await resolveAlertRequest(alertId);
    }

    await reloadDataset();
  };

  const addApi = async (payload: CreateApiPayload) => {
    await createApiDefinition(payload);
    await reloadDataset();
  };

  const deleteApi = async (apiId: string) => {
    await deleteApiDefinition(apiId);
    await reloadDataset();
  };

  const updateSettings = (settings: SettingsState) => {
    const nextDataset = applySettingsToDataset(dataset, settings, profileName, profileRole);
    const storedRecord = writeStoredSettingsRecord(settingsStorageUser, nextDataset.settings);
    setDataset(nextDataset);
    setSettingsSavedAt(storedRecord?.updatedAt ?? new Date().toISOString());
  };

  const launchMasterAgent = async (goal?: string) => {
    const execution = await launchMasterAgentRequest(goal ?? dataset.hospital.mission);
    setActiveExecution(execution);
    return execution;
  };

  const generateProcurementRequest = async (payload?: GenerateProcurementPayload) => {
    const order = await generateProcurementRequestApi(payload);
    await reloadDataset();
    return order;
  };

  const updateOrderStatus = async (orderId: string, status: ReviewOrderStatus) => {
    await updateOrderReviewStatus(orderId, status);
    await reloadDataset();
  };

  const updateOrderStatuses = async (orderIds: string[], status: ReviewOrderStatus) => {
    const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)));

    if (!uniqueIds.length) {
      return;
    }

    for (const orderId of uniqueIds) {
      await updateOrderReviewStatus(orderId, status);
    }

    await reloadDataset();
  };

  const sendChatMessage = async (message: string) => {
    const response = await sendChatMessageRequest(message);
    setActiveExecution(response.execution);
    await reloadDataset();
    return response.reply;
  };

  const dashboardMetrics = buildDashboardMetrics(dataset);
  const procurementActivity = buildProcurementActivity(dataset.orders);

  return (
    <AppDataContext.Provider
      value={{
        dataset,
        dashboardMetrics,
        procurementActivity,
        activeExecution,
        loadError,
        settingsSavedAt,
        addFile,
        addFiles,
        deleteFile,
        deleteFiles,
        resolveAlert,
        resolveAlerts,
        addApi,
        deleteApi,
        updateSettings,
        sendChatMessage,
        launchMasterAgent,
        generateProcurementRequest,
        updateOrderStatus,
        updateOrderStatuses,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}
