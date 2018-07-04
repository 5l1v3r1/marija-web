import {Field} from "./field";
import {DefaultConfigs} from "../../datasources/interfaces/defaultConfigs";
import { Connector } from '../../graph/interfaces/connector';

export interface FieldsState {
    availableFields: Field[];
    fieldsFetching: boolean;
    defaultConfigs: DefaultConfigs;
    connectors: Connector[];
}