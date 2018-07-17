export interface Field {
    path: string;
    type: string;
    datasourceId: string;
    icon?: string;
    childOf?: string;
    exampleValues?: string[];
}