import * as fs from 'fs';
import * as path from 'path';
import { ITranspile, Logger, Scope } from '@cmmv/core';

export class RepositoryTranspile implements ITranspile {
    private logger: Logger = new Logger('RepositoryTranspile');

    run(): void {
        const contracts = Scope.getArray<any>('__contracts');

        contracts?.forEach((contract: any) => {
            if (contract.generateController) {
                this.generateEntity(contract);
                this.generateService(contract);
            }
        });
    }

    private generateEntity(contract: any): void {
        const outputPath = path.resolve(contract.protoPath);
        const outputDir = path.dirname(outputPath);
        const entityName = contract.controllerName;
        const modelName = `${entityName}.Model`;
        const entityFileName = `${entityName.toLowerCase()}.entity.ts`;

        const entityTemplate = `// Generated automatically by CMMV
        
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { ${entityName} } from '../models/${modelName.toLowerCase()}';

@Entity('${entityName.toLowerCase()}')
${this.generateIndexes(entityName, contract.fields)}
export class ${entityName}Entity implements ${entityName} {
    @PrimaryGeneratedColumn('uuid')
    id: string;

${contract.fields.map((field: any) => this.generateField(field)).join('\n')}
}
`;

        const dirname = path.resolve(outputDir, '../entities');

        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });

        const outputFilePath = path.join(
            outputDir,
            '../entities',
            entityFileName,
        );
        fs.writeFileSync(outputFilePath, entityTemplate, 'utf8');
    }

    private generateService(contract: any): void {
        const outputPath = path.resolve(contract.protoPath);
        const outputDir = path.dirname(outputPath);
        const serviceName = `${contract.controllerName}Service`;
        const modelName = `${contract.controllerName}`;
        const entityName = `${contract.controllerName}Entity`;
        const serviceFileName = `${contract.controllerName.toLowerCase()}.service.ts`;

        const serviceTemplate = `// Generated automatically by CMMV
    
import { classToPlain, plainToClass } from 'class-transformer';
import { Telemetry } from "@cmmv/core";
import { AbstractService, Service } from '@cmmv/http';
import { Repository } from '@cmmv/repository';
import { ${entityName} } from '../entities/${modelName.toLowerCase()}.entity';

@Service("${contract.controllerName.toLowerCase()}")
export class ${serviceName} extends AbstractService {
    public override name = "${contract.controllerName.toLowerCase()}";

    async getAll(queries?: any, req?: any): Promise<${entityName}[]> {
        try{
            Telemetry.start('${serviceName}::GetAll', req?.requestId);
            let result = await Repository.findAll(${entityName});
            Telemetry.end('${serviceName}::GetAll', req?.requestId);
            return result;
        }
        catch(e){}
    }

    async getById(id: string, req?: any): Promise<${entityName}> {
        try{
            Telemetry.start('${serviceName}::GetById', req?.requestId);
            const item = await Repository.findBy(${entityName}, { id });
            Telemetry.end('${serviceName}::GetById', req?.requestId);

            if (!item) 
                throw new Error('Item not found');
            
            return item;
        }
        catch(e){}
    }

    async add(item: Partial<${entityName}>, req?: any): Promise<${entityName}> {
        try{
            Telemetry.start('${serviceName}::Add', req?.requestId);
            const result = await Repository.insert<${entityName}>(${entityName}, item);
            Telemetry.end('${serviceName}::Add', req?.requestId);
            return result;
        }
        catch(e){}
    }

    async update(id: string, item: Partial<${entityName}>, req?: any): Promise<${entityName}> {
        try{
            Telemetry.start('${serviceName}::Update', req?.requestId);
            const result = await Repository.update(${entityName}, id, item);
            Telemetry.end('${serviceName}::Update', req?.requestId);
            return result;
        }
        catch(e){}
    }

    async delete(id: string, req?: any): Promise<{ success: boolean, affected: number }> {
        try{
            Telemetry.start('${serviceName}::Delete', req?.requestId);
            const result = await Repository.delete(${entityName}, id);
            Telemetry.end('${serviceName}::Delete', req?.requestId);
            return { success: result.affected > 0, affected: result.affected };
        }
        catch(e){}
    }
}`;

        const dirname = path.resolve(outputDir, '../services');

        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });

        const outputFilePath = path.join(
            outputDir,
            '../services',
            serviceFileName,
        );
        fs.writeFileSync(outputFilePath, serviceTemplate, 'utf8');
    }

    private generateIndexes(entityName: string, fields: any[]): string {
        const indexDecorators = fields
            .filter(field => field.index || field.unique)
            .map(field => {
                const indexName = `idx_${entityName.toLowerCase()}_${field.propertyKey}`;
                const columns = `["${field.propertyKey}"]`;
                const uniqueOption = field.unique ? `{ unique: true }` : '';
                return `@Index("${indexName}", ${columns}${uniqueOption ? `, ${uniqueOption}` : ''})`;
            });

        return indexDecorators.join('\n');
    }

    private generateField(field: any): string {
        const tsType = this.mapToTsType(field.protoType);
        const typeormType = this.mapToTypeORMType(field.protoType);

        const columnOptions = this.generateColumnOptions(field);
        const decorators = [`@Column({ ${columnOptions} })`];

        return `    ${decorators.join(' ')}\n    ${field.propertyKey}: ${tsType};`;
    }

    private generateColumnOptions(field: any): string {
        const options = [];
        options.push(`type: '${this.mapToTypeORMType(field.protoType)}'`);
        if (field.defaultValue !== undefined)
            options.push(`default: ${JSON.stringify(field.defaultValue)}`);
        if (field.protoRepeated) options.push('array: true');
        return options.join(', ');
    }

    private mapToTsType(protoType: string): string {
        const typeMapping: { [key: string]: string } = {
            string: 'string',
            bool: 'boolean',
            int32: 'number',
            float: 'number',
            double: 'number',
            any: 'any',
        };

        return typeMapping[protoType] || 'string';
    }

    private mapToTypeORMType(type: string): string {
        const typeMapping: { [key: string]: string } = {
            string: 'varchar',
            boolean: 'boolean',
            bool: 'boolean',
            int: 'int',
            int32: 'int',
            int64: 'bigint',
            float: 'float',
            double: 'double',
            bytes: 'bytea',
            date: 'date',
            timestamp: 'timestamp',
            text: 'text',
            json: 'json',
            jsonb: 'jsonb',
            uuid: 'uuid',
            time: 'time',
            simpleArray: 'simple-array',
            simpleJson: 'simple-json',
            bigint: 'bigint',
            uint32: 'int',
            uint64: 'bigint',
            sint32: 'int',
            sint64: 'bigint',
            fixed32: 'int',
            fixed64: 'bigint',
            sfixed32: 'int',
            sfixed64: 'bigint',
            any: 'simple-json',
        };

        return typeMapping[type] || 'varchar';
    }
}
