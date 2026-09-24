import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "./apiClient";
import service from "./contractorAvailabilityService";

vi.mock("./apiClient", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

describe("contractorAvailabilityService", () => {
  it("sends the applied date range as list query parameters", async () => {
    apiClient.get.mockResolvedValue({ data: [{ id: 1 }] });
    await expect(service.list({ fromDate: "2026-09-21", toDate: "2026-09-24" })).resolves.toEqual([{ id: 1 }]);
    expect(apiClient.get).toHaveBeenCalledWith("/contractor/availability", { params: { from_date: "2026-09-21", to_date: "2026-09-24" } });
  });

  it("requests the unfiltered list without date parameters", async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await service.list();
    expect(apiClient.get).toHaveBeenCalledWith("/contractor/availability", { params: undefined });
  });
});
