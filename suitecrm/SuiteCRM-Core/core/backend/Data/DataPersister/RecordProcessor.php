<?php
/**
 * SuiteCRM is a customer relationship management program developed by SalesAgility Ltd.
 * Copyright (C) 2021 SalesAgility Ltd.
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License version 3 as published by the
 * Free Software Foundation with the addition of the following permission added
 * to Section 15 as permitted in Section 7(a): FOR ANY PART OF THE COVERED WORK
 * IN WHICH THE COPYRIGHT IS OWNED BY SALESAGILITY, SALESAGILITY DISCLAIMS THE
 * WARRANTY OF NON INFRINGEMENT OF THIRD PARTY RIGHTS.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * In accordance with Section 7(b) of the GNU Affero General Public License
 * version 3, these Appropriate Legal Notices must retain the display of the
 * "Supercharged by SuiteCRM" logo. If the display of the logos is not reasonably
 * feasible for technical reasons, the Appropriate Legal Notices must display
 * the words "Supercharged by SuiteCRM".
 */


namespace App\Data\DataPersister;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Data\Entity\Record;
use App\Data\Service\Record\ApiRecordMappers\ApiRecordMapperRunner;
use App\Data\Service\RecordProviderInterface;

class RecordProcessor implements ProcessorInterface
{
    protected RecordProviderInterface $recordProvider;
    protected ApiRecordMapperRunner $apiRecordMapperRunner;

    /**
     * RecordProcessor constructor.
     * @param RecordProviderInterface $recordProvider
     * @param ApiRecordMapperRunner $apiRecordMapperRunner
     */
    public function __construct(
        RecordProviderInterface $recordProvider,
        ApiRecordMapperRunner $apiRecordMapperRunner
    ) {
        $this->recordProvider = $recordProvider;
        $this->apiRecordMapperRunner = $apiRecordMapperRunner;
    }

    /**
     * @inheritDoc
     */
    public function supports($data, array $context = []): bool
    {
        return $data instanceof Record;
    }

    /**
     * Handle Process create / update request
     * @param Record $record
     * @param Operation $operation
     * @param array $uriVariables
     * @param array $context
     * @return Record|null
     */
    public function process(mixed $record, Operation $operation, array $uriVariables = [], array $context = []): ?Record
    {
        $this->apiRecordMapperRunner->toInternal($record, 'save');
        $resultingRecord = $this->recordProvider->saveRecord($record);
        $this->apiRecordMapperRunner->toExternal($resultingRecord, 'save');

        return $resultingRecord;
    }

}
