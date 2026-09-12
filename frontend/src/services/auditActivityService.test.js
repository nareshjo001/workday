import { describe, expect, it, vi } from "vitest";
import apiClient from "./apiClient";
import service, { parseActivity } from "./auditActivityService";
vi.mock("./apiClient", () => ({ default: { get: vi.fn() } }));
const item={id:9,occurred_at:"2026-09-12T10:00:00.000Z",event:"TIMESHEET_SUBMITTED",actor:{display_name:"Alex",role:"CONTRACTOR"},entity:{type:"TIMESHEET",id:"2"},title:"Timesheet submitted",summary:"Alex submitted a timesheet.",details:[{label:"Hours",value:8}]};
const valid={project:{id:2,name:"Atlas",status:"ACTIVE"},items:[item],pagination:{page:1,limit:25,total:1,total_pages:1}};
describe("auditActivityService",()=>{
  it("uses only the role-safe endpoint and preserves the server projection",async()=>{apiClient.get.mockResolvedValue({data:valid});await expect(service.project(2)).resolves.toEqual(valid);expect(apiClient.get).toHaveBeenCalledWith("/pm/projects/2/activity",{params:{page:1,limit:25}});});
  it("fails closed for malformed or unsafe detail values",()=>{expect(()=>parseActivity({...valid,items:[{...item,details:[{label:"bad",value:{raw:true}}]}]},{project:true})).toThrow("Invalid activity response.");expect(()=>parseActivity({...valid,pagination:{...valid.pagination,total:"1"}},{project:true})).toThrow("Invalid activity response.");});
});
