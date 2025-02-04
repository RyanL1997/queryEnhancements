/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SharedGlobalConfig, Logger, ILegacyClusterClient } from 'opensearch-dashboards/server';
import { Observable } from 'rxjs';
import { ISearchStrategy, SearchUsage } from '../../../../src/plugins/data/server';
import {
  DATA_FRAME_TYPES,
  IDataFrameError,
  IDataFrameResponse,
  IOpenSearchDashboardsSearchRequest,
  PartialDataFrame,
  createDataFrame,
} from '../../../../src/plugins/data/common';
import { Facet } from '../utils';

export const sqlSearchStrategyProvider = (
  config$: Observable<SharedGlobalConfig>,
  logger: Logger,
  client: ILegacyClusterClient,
  usage?: SearchUsage
): ISearchStrategy<IOpenSearchDashboardsSearchRequest, IDataFrameResponse> => {
  const sqlFacet = new Facet(client, logger, 'ppl.sqlQuery');

  return {
    search: async (context, request: any, options) => {
      try {
        request.body.query = request.body.query.qs;
        const rawResponse: any = await sqlFacet.describeQuery(context, request);

        if (!rawResponse.success) {
          return {
            type: DATA_FRAME_TYPES.DEFAULT,
            body: { error: rawResponse.data },
            took: rawResponse.took,
          } as IDataFrameError;
        }

        const partial: PartialDataFrame = {
          name: '',
          fields: rawResponse.data?.schema || [],
        };
        const dataFrame = createDataFrame(partial);
        dataFrame.fields.forEach((field, index) => {
          field.values = rawResponse.data.datarows.map((row: any) => row[index]);
        });

        dataFrame.size = rawResponse.data.datarows?.length || 0;

        if (usage) usage.trackSuccess(rawResponse.took);

        return {
          type: DATA_FRAME_TYPES.DEFAULT,
          body: dataFrame,
          took: rawResponse.took,
        } as IDataFrameResponse;
      } catch (e) {
        logger.error(`sqlSearchStrategy: ${e.message}`);
        if (usage) usage.trackError();
        throw e;
      }
    },
  };
};
