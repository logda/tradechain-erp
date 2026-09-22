export type CreateSampleOrderVersionDto = {
  currentStatus: string;
  currentVersionNo: number;
  createdBy: number;
  sampleRequirements: string;
  changeReason: string;
  samplingCost?: number;
};
