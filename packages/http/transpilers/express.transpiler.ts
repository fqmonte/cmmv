import * as fs from 'fs';
import * as path from 'path';

import { Application, ITranspile, Logger, Scope } from '@cmmv/core';

export class ExpressTranspile implements ITranspile {
    private logger: Logger = new Logger('ExpressTranspile');

    run(): void {
        const contracts = Scope.getArray<any>('__contracts');
        const controllers = [];
        const providers = [];

        contracts?.forEach((contract: any) => {
            if (contract.generateController) {
                this.generateModel(contract);
                this.generateService(contract);
                this.generateController(contract);
                controllers.push(`${contract.controllerName}Controller`);
                providers.push(`${contract.controllerName}Service`);
            }
        });

        this.generateModule(controllers, providers);
    }

    private generateModel(contract: any): void {
        const outputPath = path.resolve(contract.protoPath);
        const outputDir = path.dirname(outputPath);
        const modelName = `${contract.controllerName}`;
        const modelInterfaceName = `I${modelName}`;
        const modelFileName = `${modelName.toLowerCase()}.model.ts`;

        const modelTemplate = `// Generated automatically by CMMV

${this.generateClassImports(contract)}
        
export interface ${modelInterfaceName} {
    id?: any;
${contract.fields.map((field: any) => `    ${field.propertyKey}: ${this.mapToTsType(field.protoType)};`).join('\n')}
}

export class ${modelName} implements ${modelInterfaceName} {
    id?: any;

${contract.fields.map((field: any) => this.generateClassField(field)).join('\n\n')}
}
`;

        const dirname = path.resolve(outputDir, '../models');

        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });

        const outputFilePath = path.join(outputDir, '../models', modelFileName);
        fs.writeFileSync(outputFilePath, modelTemplate, 'utf8');
    }

    private generateService(contract: any): void {
        const outputPath = path.resolve(contract.protoPath);
        const outputDir = path.dirname(outputPath);
        const serviceName = `${contract.controllerName}Service`;
        const modelName = `${contract.controllerName}`;
        const modelInterfaceName = `I${modelName}`;
        const serviceFileName = `${contract.controllerName.toLowerCase()}.service.ts`;

        const serviceTemplate = `// Generated automatically by CMMV

import { classToPlain, plainToClass } from 'class-transformer';
import { AbstractService, Service } from '@cmmv/http';
import { ${modelName}, ${modelInterfaceName} } from '../models/${modelName.toLowerCase()}.model';

@Service("${contract.controllerName.toLowerCase()}")
export class ${serviceName} extends AbstractService {
    public override name = "${contract.controllerName.toLowerCase()}";
    private items: ${modelName}[] = [];

    async getAll(queries?: any, req?: any): Promise<${modelName}[]> {
        return this.items;
    }

    async getById(id: string, req?: any): Promise<${modelName}> {
        const item = this.items.find(i => i.id === id);

        if (item) 
            return item;
        
        throw new Error('Item not found');
    }

    async add(item: ${modelInterfaceName}, req?: any): Promise<${modelName}> {
        item['id'] = this.items.length + 1;
        const newItem = plainToClass(${modelName}, item, { excludeExtraneousValues: true });
        this.items.push(newItem);
        return item;
    }

    async update(id: string, item: ${modelInterfaceName}, req?: any): Promise<${modelName}> {
        const index = this.items.findIndex(i => i.id === parseInt(id));

        if (index !== -1){
            let itemRaw = classToPlain(this.items[index]);
            let updateItem = { ...itemRaw, ...item };
            this.items[index] = plainToClass(${modelName}, updateItem, { excludeExtraneousValues: true })
            return this.items[index];
        }
                    
        throw new Error('Item not found');
    }

    async delete(id: string, req?: any): Promise<{ success: boolean, affected: number }> {
        const index = this.items.findIndex(i => i.id === parseInt(id));

        if (index !== -1) {
            this.items.splice(index, 1);
            return { success: true, affected: 1 };
        }
                    
        throw new Error('Item not found');
    }
}
`;

        const dirname = path.resolve(outputDir, '../services');

        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });

        const outputFilePath = path.join(
            outputDir,
            '../services',
            serviceFileName,
        );
        fs.writeFileSync(outputFilePath, serviceTemplate, 'utf8');
    }

    private generateController(contract: any): void {
        const outputPath = path.resolve(contract.protoPath);
        const outputDir = path.dirname(outputPath);
        const controllerName = `${contract.controllerName}Controller`;
        const serviceName = `${contract.controllerName}Service`;
        const controllerFileName = `${contract.controllerName.toLowerCase()}.controller.ts`;

        const controllerTemplate = `// Generated automatically by CMMV
    
import { Telemetry } from "@cmmv/core";  
import { Controller, Get, Post, Put, Delete, Queries, Param, Body, Request } from '@cmmv/http';
import { ${serviceName} } from '../services/${contract.controllerName.toLowerCase()}.service';
import { ${contract.controllerName} } from '../models/${contract.controllerName.toLowerCase()}.model';

@Controller('${contract.controllerName.toLowerCase()}')
export class ${controllerName} {
    constructor(private readonly ${serviceName.toLowerCase()}: ${serviceName}) {}

    @Get()
    async getAll(@Queries() queries: any, @Request() req): Promise<${contract.controllerName}[]> {
        Telemetry.start('${controllerName}::GetAll', req.requestId);
        let result = await this.${serviceName.toLowerCase()}.getAll(queries, req);
        Telemetry.end('${controllerName}::GetAll', req.requestId);
        return result;
    }

    @Get(':id')
    async getById(@Param('id') id: string, @Request() req): Promise<${contract.controllerName}> {
        Telemetry.start('${controllerName}::GetById', req.requestId);
        let result = await this.${serviceName.toLowerCase()}.getById(id, req);
        Telemetry.end('${controllerName}::GetById', req.requestId);
        return result;
    }

    @Post()
    async add(@Body() item: ${contract.controllerName}, @Request() req): Promise<${contract.controllerName}> {
        Telemetry.start('${controllerName}::Add', req.requestId);
        let result = await this.${serviceName.toLowerCase()}.add(item, req);
        Telemetry.end('${controllerName}::Add', req.requestId);
        return result;
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() item: ${contract.controllerName}, @Request() req): Promise<${contract.controllerName}> {
        Telemetry.start('${controllerName}::Update', req.requestId);
        let result = await this.${serviceName.toLowerCase()}.update(id, item, req);
        Telemetry.end('${controllerName}::Update', req.requestId);
        return result;
    }

    @Delete(':id')
    async delete(@Param('id') id: string, @Request() req): Promise<{ success: boolean, affected: number }> {
        Telemetry.start('${controllerName}::Delete', req.requestId);
        let result = await this.${serviceName.toLowerCase()}.delete(id, req);
        Telemetry.end('${controllerName}::Delete', req.requestId);
        return result;
    }
}
`;
        const dirname = path.resolve(outputDir, '../controllers');

        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });

        const outputFilePath = path.join(
            outputDir,
            '../controllers',
            controllerFileName,
        );
        fs.writeFileSync(outputFilePath, controllerTemplate, 'utf8');
    }

    private generateModule(controllers: string[], providers: string[]): void {
        Application.appModule.controllers = [
            ...Application.appModule.controllers,
            ...controllers.map(name => {
                return {
                    name,
                    path: `./controllers/${name.replace('Controller', '').toLowerCase()}.controller`,
                };
            }),
        ];
        Application.appModule.providers = [
            ...Application.appModule.providers,
            ...providers.map(name => {
                return {
                    name,
                    path: `./services/${name.replace('Service', '').toLowerCase()}.service`,
                };
            }),
        ];
    }

    private generateClassImports(contract: any): string {
        let importStatements: string[] = [];

        const hasExclude = contract.fields.some(
            (field: any) => field.exclude || field.toClassOnly,
        );
        const hasTransform = contract.fields.some(
            (field: any) => field.transform,
        );

        if (hasExclude || hasTransform) {
            let imports = [];
            if (hasExclude) imports.push('Exclude');
            if (hasTransform) imports.push('Transform');
            importStatements.push(
                `import { ${imports.join(', ')} } from 'class-transformer';`,
            );
        }

        if (contract.imports && contract.imports.length > 0) {
            for (let module of contract.imports)
                importStatements.push(
                    `import * as ${module} from '${module}';`,
                );
        }

        return importStatements.length > 0 ? importStatements.join('\n') : '';
    }

    private generateClassField(field: any): string {
        let decorators: string[] = [];

        if (field.exclude && field.toClassOnly)
            decorators.push(
                `    @Exclude(${field.toClassOnly ? `{ toClassOnly: true }` : ''})`,
            );

        if (field.transform)
            decorators.push(
                `    @Transform(${field.transform}${field.toClassOnly ? `,{ toClassOnly: true }` : ''})`,
            );

        return `${decorators.length > 0 ? decorators.join('\n') + '\n' : ''}    ${field.propertyKey}: ${this.mapToTsType(field.protoType)};`;
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
}
