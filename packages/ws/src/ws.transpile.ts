import * as fs from 'fs';
import * as path from 'path';

import { Application, ITranspile, Scope } from '@cmmv/core';

export class WSTranspile implements ITranspile {
    run(): void {
        const contracts = Scope.getArray<any>('__contracts');

        contracts?.forEach((contract: any) => {
            if (contract.generateController) this.generateGateway(contract);
        });
    }

    private generateGateway(contract: any) {
        const outputPath = path.resolve(contract.protoPath);
        const outputDir = path.dirname(outputPath);
        const gatewayName = `${contract.controllerName}Gateway`;
        const serviceName = `${contract.controllerName}Service`;
        const gatewayFileName = `${contract.controllerName.toLowerCase()}.gateway.ts`;

        const serviceTemplate = `// Generated automatically by CMMV
    
import { Rpc, Message, Data, Socket, RpcUtils } from "@cmmv/ws";
import { plainToClass } from 'class-transformer';
import { ${contract.controllerName}Entity } from '../entities/${contract.controllerName.toLowerCase()}.entity';

import { 
    Add${contract.controllerName}Request, 
    Update${contract.controllerName}Request,   
    Delete${contract.controllerName}Request 
} from "../protos/${contract.controllerName.toLowerCase()}";

import { ${serviceName} } from '../services/${contract.controllerName.toLowerCase()}.service';

@Rpc("${contract.controllerName.toLowerCase()}")
export class ${gatewayName} {
    constructor(private readonly ${serviceName.toLowerCase()}: ${serviceName}) {}

    @Message("GetAll${contract.controllerName}Request")
    async getAll(@Socket() socket){
        try{
            const items = await this.${serviceName.toLowerCase()}.getAll();
            const response = await RpcUtils.pack("${contract.controllerName.toLowerCase()}", "GetAll${contract.controllerName}Response", items);

            if(response)
                socket.send(response);
        }
        catch(e){}
    }

    @Message("Add${contract.controllerName}Request")
    async add(@Data() data: Add${contract.controllerName}Request, @Socket() socket){
        try{
            const entity = plainToClass(${contract.controllerName}Entity, data.item);
            const result = await this.${serviceName.toLowerCase()}.add(entity);
            const response = await RpcUtils.pack("${contract.controllerName.toLowerCase()}", "Add${contract.controllerName}Response", { item: result, id: result.id });

            if(response)
                socket.send(response);
        }
        catch(e){}
    }

    @Message("Update${contract.controllerName}Request")
    async update(@Data() data: Update${contract.controllerName}Request, @Socket() socket){
        try{
            const entity = plainToClass(${contract.controllerName}Entity, data.item);
            const result = await this.${serviceName.toLowerCase()}.update(data.id, entity);
            const response = await RpcUtils.pack("${contract.controllerName.toLowerCase()}", "Update${contract.controllerName}Response", { item: result, id: result.id });

            if(response)
                socket.send(response);
        }
        catch(e){}
    }

    @Message("Delete${contract.controllerName}Request")
    async delete(@Data() data: Delete${contract.controllerName}Request, @Socket() socket){
        try{
            const result = (await this.${serviceName.toLowerCase()}.delete(data.id)).success;
            const response = await RpcUtils.pack("${contract.controllerName.toLowerCase()}", "Delete${contract.controllerName}Response", { success: result, id: data.id });

            if(response)
                socket.send(response);
        }
        catch(e){}
    }
}`;

        Application.appModule.providers.push({
            name: gatewayName,
            path: `./gateways/${contract.controllerName.toLowerCase()}.gateway`,
        });

        const dirname = path.resolve(outputDir, '../gateways');

        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });

        const outputFilePath = path.join(
            outputDir,
            '../gateways',
            gatewayFileName,
        );
        fs.writeFileSync(outputFilePath, serviceTemplate, 'utf8');
    }
}
