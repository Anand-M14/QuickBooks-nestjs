import {
  Controller,
  Post,
  Body,
  HttpException,
  Get,
  Query,
  Res,
  HttpStatus,
  UploadedFile,
  UseInterceptors
 } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuickBooksConnection } from './entities/quickbooks-connection.entity.js';
import { Repository } from 'typeorm';
import axios from 'axios';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import FormData from 'form-data';

@Controller('quickbooks')
export class QuickBooksController {
  constructor(
    @InjectRepository(QuickBooksConnection)
    private readonly quickBooksConnections: Repository<QuickBooksConnection>,
  ) {}

  @Post('authorize')
  async authorize(@Res() res: Response) {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const redirecturi = process.env.QUICKBOOKS_REDIRECT_URI;

    const state = 'quickbooks_auth';

    const authurl =
      `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}`;

    const authorize =
      `${authurl}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${redirecturi}&state=${state}`;

    res.redirect(authorize);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('realmId') realmId: string,
  ) {
    if (state !== 'quickbooks_auth') {
      throw new HttpException(
        'Invalid OAuth state',
        HttpStatus.BAD_REQUEST,
      );
    }

    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI!;
    const credentials =`${clientId}:${clientSecret}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');
    const formData = new URLSearchParams();
    formData.append('grant_type','authorization_code',);
    formData.append('code', code);
    formData.append('redirect_uri',redirectUri,);
    const tokenUrl ='https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const tokenResponse = await axios.post(tokenUrl,formData.toString(),{
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:`Basic ${encodedCredentials}`,
        },
      },
    );
    console.log(tokenResponse.data);
    const {access_token, refresh_token, expires_in,} = tokenResponse.data;

    const connection = await this.quickBooksConnections.findOne({where: {realmId: realmId,}, });

    if (!connection) {
      throw new HttpException('Connection Not Found',
        HttpStatus.NOT_FOUND,
      );
    }
    connection.accessToken = access_token;
    connection.refreshToken = refresh_token;
    connection.expiresAt = new Date( Date.now() + expires_in * 1000,);

    await this.quickBooksConnections.save(connection,);

    return {
      message:'QuickBooks OAuth authentication successful',
      realmId: realmId,
      expiresIn: expires_in,
    };
  }

  @Post('refreshToken')
  async refreshToken(@Body() data: any) {
    if (!data.connectionId) {
      throw new HttpException('connectionId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const connection = await this.quickBooksConnections.findOne({where: {id: data.connectionId,},});

    if (!connection) {
      throw new HttpException('Connection Not Found',
        HttpStatus.NOT_FOUND,
      );
    }

    const result = await this.refreshQuickBooksToken(connection,);

    return {
      message:'QuickBooks access token refreshed successfully',
      connectionId: connection.id,
      realmId: connection.realmId,
      expiresIn: result.expiresIn,
    };
  }

  private async refreshQuickBooksToken(connection: QuickBooksConnection,) {
    try {
      const clientId =process.env.QUICKBOOKS_CLIENT_ID;
      const clientSecret =process.env.QUICKBOOKS_CLIENT_SECRET;
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token',);
      formData.append('refresh_token', connection.refreshToken,);
      const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
      const credentials = `${clientId}:${clientSecret}`;
      const encodedCredentials = Buffer.from(credentials).toString('base64');

      const tokenResponse = await axios.post(tokenUrl,formData.toString(),
        {
          headers: {
            'Content-Type':'application/x-www-form-urlencoded',
            Authorization: `Basic ${encodedCredentials}`,
          },
        },
      );

      const {access_token,refresh_token, expires_in,} = tokenResponse.data;

      connection.accessToken =access_token;
      connection.refreshToken =  refresh_token;
      connection.expiresAt = new Date(Date.now() + expires_in * 1000, );
      await this.quickBooksConnections.save(connection,);

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
      };
    } catch (error) {
      console.log('QuickBooks token refresh error:',error,);

      if (axios.isAxiosError(error)) {
        throw new HttpException(
          error.response?.data ||'QuickBooks token refresh failed',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw error;
    }
  }
                          //CUSTOMER//  
  @Post('customer/create')
  async createCustomer(@Body() data: any) {
    if ( !data.connectionId || !data.DisplayName) {
      throw new HttpException('connectionId and DisplayName are required',HttpStatus.BAD_REQUEST, );
    }
     try {
      const result =await this.performQuickBooksAction('customer','create','post',data,);
      if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
     return {
        message:'Customer created successfully',
        Response: result.response,
        Status: result.status,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error instanceof Error? error.message : 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
    

@Post('customer/get')
async getCustomer(@Body() data: any) {
  if (!data || !data.connectionId || !data.Id) {
  throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
}
try{
 
 const result = await this.performQuickBooksAction('customer','get','get',data);
 if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
 return{
  message:'Customer get executed successfully',
  Response:result.response,
  Status:result.status,
 }
} catch (error) {
  if (error instanceof HttpException) {
    throw error;
  }

  throw new HttpException(
    error instanceof Error? error.message : 'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
}

@Post('customer/getMany')
async getManyCustomer(@Body() data: any) {
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is Required',HttpStatus.BAD_REQUEST,)
  }
  try{
      const result = await this.performQuickBooksAction('customer','getMany','get',data)
     if (result.status >= 400) {
       throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
      }
      return{
        message:'customer getmany executed successfully',
        Response:result.response,
        Status: result.status,
      }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal server Error',
      HttpStatus.BAD_REQUEST
    );
  }
}

@Post('customer/update')
async updateCustomer(@Body() data:any){
  if(!data || !data.connectionId || !data.Id ||data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('customer','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Customer updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}
                                    // ACCOUNT  //
@Post('account/getMany')
async getManyAccount(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('account','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Account getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
} 

@Post('account/create')
  async createAccount(@Body() data: any) {
    if ( !data.connectionId  || !data.Name || !data.AccountType) {
      throw new HttpException('connectionId, Name and AccountType are required',HttpStatus.BAD_REQUEST, );
    }
     try {
      const result =await this.performQuickBooksAction('account','create','post',data,);
      if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
     return {
        message:'Account created successfully',
        Response: result.response,
        Status: result.status,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error instanceof Error? error.message : 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

@Post('account/get')
async getAccount(@Body() data: any) {
  if (!data || !data.connectionId || !data.Id) {
  throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
}
try{
 
 const result = await this.performQuickBooksAction('account','get','get',data);
  if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
 return{
  message:'Account get executed successfully',
  Response:result.response,
  Status:result.status,
 }
} catch (error) {
  if (error instanceof HttpException) {
    throw error;
  }

  throw new HttpException(
    error instanceof Error? error.message : 'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
}

@Post('account/update')
async updateAccount(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('account','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Account updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

                                      // INVOICE //
@Post('invoice/create')
  async createInvoice(@Body() data: any) {
    if ( !data.connectionId  || !data.CustomerRef || !data.Line  ) {
      throw new HttpException('connectionId, CustomerRef and Line are required',HttpStatus.BAD_REQUEST, );
    }
     try {
      const result =await this.performQuickBooksAction('invoice','create','post',data,);
       if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
     return {
        message:'Invoice created successfully',
        Response: result.response,
        Status: result.status,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error instanceof Error? error.message : 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

@Post('invoice/get')
  async getInvoice(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('invoice','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Invoice get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

@Post('invoice/getMany')
async getManyInvoice(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('invoice','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'invoice getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('invoice/update')
async updateInvoice(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('invoice','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Invoice updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('invoice/delete')
async deleteInvoice(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('invoice','delete','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Invoice Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('invoice/void')
async voidInvoice(@Body() data: any) {
  if (!data || !data.connectionId || !data.Id ||data.SyncToken === undefined || data.SyncToken === null) {
    throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('invoice', 'void', 'post', data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return {
      message: 'Invoice Void successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('invoice/send')
async sendInvoice(@Body() data:any){
  if(!data || !data.connectionId || !data.Id  ){
  throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('invoice','send','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Invoice Send successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('invoice/pdf')
async getInvoicePdf(@Body() data:any, @Res()res:Response,){
    if(!data || !data.connectionId || !data.Id  ){
       throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
    const result = await this.performQuickBooksAction('invoice','pdf','get',data,);
    if(result.status !==200){
      throw new HttpException(
        result.response || 'failed to get invoice pdf ',
        result.status,
      )
    }
    res.set({
      'Content-Type':'application/pdf',
      'Content-Disposition':`inline;filename="invoice-${data.Id}.pdf"`
    });
    return res.send(Buffer.from(result.response));
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}
                                       // PAYMENT //
@Post('payment/create')
async createPayment(@Body() data: any) {
  if (!data || !data.connectionId || !data.CustomerRef || data.TotalAmt===undefined || data.TotalAmt===null) {
    throw new HttpException('connectionId, CustomerRef and TotalAmt are required', HttpStatus.BAD_REQUEST, );
  }

  try {
    const result = await this.performQuickBooksAction('payment', 'create', 'post', data,);
    if (result.status >= 400) {
      throw new HttpException(result.response || 'QuickBooks request failed', result.status,);
    }

    return {
      message: 'Payment created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }

    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('payment/get')
  async getPayment(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('payment','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Payment get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('payment/getMany')
async getManyPayment(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('payment','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'payment getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('payment/update')
async updatePayment(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('payment','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Payment updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('payment/delete')
async deletePayment(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('payment','delete','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Payment Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('payment/void')
async voidPayment(@Body() data: any) {
  if (!data || !data.connectionId || !data.Id ||data.SyncToken === undefined || data.SyncToken === null) {
    throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('payment', 'void', 'post', data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return {
      message: 'Payment Void successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('payment/send')
async sendPayment(@Body() data:any){
  if(!data || !data.connectionId || !data.Id  ){
  throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('payment','send','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Payment Send successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('payment/pdf')
async getPaymentPdf(@Body() data:any, @Res()res:Response,){
    if(!data || !data.connectionId || !data.Id  ){
       throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
    const result = await this.performQuickBooksAction('payment','pdf','get',data,);
    if(result.status !==200){
      throw new HttpException(
        result.response || 'failed to get payment pdf ',
        result.status,
      )
    }
    res.set({
      'Content-Type':'application/pdf',
      'Content-Disposition':`inline;filename="payment-${data.Id}.pdf"`
    });
    return res.send(Buffer.from(result.response));
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

                                         // SALESRECEIPT //
@Post('salesreceipt/create')
async createSalesReceipt(@Body() data: any) {
  if (!data || !data.connectionId || !data.CustomerRef || !data.Line) {
    throw new HttpException('connectionId, CustomerRef and TotalAmt are required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('salesreceipt', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'SalesReceipt created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('salesreceipt/get')
  async getSalesReceipt(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('salesreceipt','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'SalesReceipt get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('salesreceipt/getMany')
async getManySalesReceipt(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('salesreceipt','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'SalesReceipt getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('salesreceipt/update')
async updateSalesReceipt(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null || !data.CustomerRef || !data.Line   ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('salesreceipt','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'SalesReceipt updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('salesreceipt/sparseUpdate')
async sparseUpdateSalesReceipt(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null   ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('salesreceipt','sparseUpdate','post',{...data,sparse:true});
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'SalesReceipt updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('salesreceipt/delete')
async deleteSalesReceipt(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('salesreceipt','delete','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'salesreceipt Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('salesreceipt/void')
async voidSalesReceipt(@Body() data: any) {
  if (!data || !data.connectionId || !data.Id ||data.SyncToken === undefined || data.SyncToken === null) {
    throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('salesreceipt', 'void', 'post', data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return {
      message: 'SalesReceipt Void successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('salesreceipt/send')
async sendSalesReceipt(@Body() data:any){
  if(!data || !data.connectionId || !data.Id  ){
  throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('salesreceipt','send','post',data,);
     if (result.status >= 401) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'salesReceipt Send successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('salesreceipt/pdf')
async getSalesReceiptPdf(@Body() data:any, @Res()res:Response,){
    if(!data || !data.connectionId || !data.Id  ){
       throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
    const result = await this.performQuickBooksAction('salesreceipt','pdf','get',data,);
    if(result.status !==200){
      throw new HttpException(
        result.response || 'failed to get salesreceipt pdf ',
        result.status,
      )
    }
    res.set({
      'Content-Type':'application/pdf',
      'Content-Disposition':`inline;filename="salesreceipt-${data.Id}.pdf"`
    });
    return res.send(Buffer.from(result.response));
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

                                       // TAXCLASSIFICATION //

@Post('taxclassification/get')
  async getTaxClassification(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('taxclassification','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'TaxClassification get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
}

@Post('taxclassification/getAll')
async getAllTaxClassifications(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('taxclassification','getALl','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TaxClassification  getALl executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('taxclassification/getByParentId')
async getTaxClassificationByParentId(@Body() data: any) {
  if (!data || !data.connectionId || !data.parentId) {
    throw new HttpException('connectionId and parentId are required', HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('taxclassification', 'getByParentId','get', data, );
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'TaxClassification getByParentId executed successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('taxclassification/getByLevel')
async getTaxClassificationsByLevel(@Body() data: any) {
  if (!data || !data.connectionId || data.level === undefined || data.level === null) {
    throw new HttpException('connectionId and level are required', HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('taxclassification','getByLevel', 'get',data, );
    if (result.status >= 400) {
      throw new HttpException(result.response || 'QuickBooks request failed', result.status,);
    }
    return {
      message: 'TaxClassification getByLevel executed successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

                                        // TAXCODE //
@Post('taxcode/getMany')
async getManyTaxCode(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('taxcode','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TaxCode getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('taxcode/get')
  async getTaxCode(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('taxcode','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Taxcode get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
}

                                        // TAXPAYMENT //
@Post('taxpayment/getMany')
async getManyTaxPayment(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('taxpayment','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TaxPayment getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('taxpayment/get')
  async getTaxPayment(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('taxpayment','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'TaxPayment get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
}

                                        // TAXRATE //
@Post('taxrate/getMany')
async getManyTaxRate(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('taxrate','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TaxRate getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('taxrate/get')
  async getTaxrate(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('taxrate','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'TaxRate get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
}

                             // TAXSERVICE //
  @Post('taxservice/create')
async createTaxService(@Body() data: any) {
  if (!data || !data.connectionId  ) {
    throw new HttpException('connectionId, CustomerRef and TotalAmt are required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('taxservice', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'TaxService created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

                                        // TAXSUMMARY //
@Post('taxsummary/getMany')
async getManyTaxSummary(@Body() data:any){
  if(!data || !data.connectionId || !data.agency_id || !data.start_date || !data.end_date){
    throw new HttpException('connectionId, agency_id, start_date and end_date are required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('taxsummary','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TaxSummary getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                      // TAXAGENCY //
@Post('taxagency/create')
async createTaxAgency(@Body() data: any) {
  if (!data || !data.connectionId) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('taxagency', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'TaxAgency created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('taxagency/get')
  async getTaxAgency(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('taxagency','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'TaxAgency get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('taxagency/getMany')
async getManyTaxAgency(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('taxagency','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TaxAgency getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                         // TERM //
@Post('term/create')
async createTerm(@Body() data: any) {
  if (!data || !data.connectionId ) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('term', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'Term created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('term/get')
  async getTerm(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('term','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Term get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('term/getMany')
async getManyTerm(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('term','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Term getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('term/update')
async updateTerm(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('term','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Term updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

                                         // TIMEACTIVITY //
@Post('timeactivity/create')
async createTimeActivity(@Body() data: any) {
  if (!data || !data.connectionId) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('timeactivity', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'TimeActivity created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('timeactivity/get')
  async getTimeActivity(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('timeactivity','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'TimeActivity get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('timeactivity/getMany')
async getManyTimeActivity(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('timeactivity','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TimeActivity getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('timeactivity/update')
async updateTimeActivity(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('timeactivity','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TimeActivity updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('timeactivity/delete')
async deleteTimeActivity(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('timeactivity','delete','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TimeActivity Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

                                  // TRANSACTIONLIST //
@Post('transactionlist/getMany')
async getManyTransactionList(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('transactionlist','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TransactionList getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                  // TRANSACTIONLISTBYVENDOR //
@Post('transactionlistbyvendor/getMany')
async getManyTransactionListByVendor(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('transactionlistbyvendor','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TransactionListByVendor getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                  // TRANSACTIONLISTBYCUSTOMER //
@Post('transactionlistbycustomer/getMany')
async getManyTransactionListByCustomer(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('transactionlistbycustomer','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TransactionListByCustomer getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                 // TRANSACTIONLISTWITHSPLITS //
@Post('transactionlistwithsplits/getMany')
async getManyTransactionListWithSplits(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('transactionlistwithsplits','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TransactionListWithSplits getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                         // TRANSFER //
@Post('transfer/create')
async createTransfer(@Body() data: any) {
  if (!data || !data.connectionId ) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('transfer', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'Transfer created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('transfer/get')
  async getTransfer(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('transfer','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Transfer get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('transfer/getMany')
async getManyTransfer(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('transfer','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Transfer getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('transfer/update')
async updateTransfer(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null  ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('transfer','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Transfer updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('transfer/sparseUpdate')
async sparseUpdateTransfer(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null  ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('transfer','sparseUpdate','post',{...data,sparse:true});
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Transfer updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('transfer/delete')
async deleteTransfer(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('transfer','delete','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Transfer Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}


                                 // TRIALBALANCE //
@Post('trialbalance/getMany')
async getManyTrialBalance(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('trialbalance','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'TrialBalance getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                         // VENDOR //
@Post('vendor/create')
async createVendor(@Body() data: any) {
  if (!data || !data.connectionId ) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('vendor', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'Vendor created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('vendor/get')
  async getVendor(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('vendor','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Vendor get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('vendor/getMany')
async getManyVendor(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('vendor','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Vendor getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('vendor/update')
async updateVendor(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null  ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('vendor','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Vendor updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('vendorbalance/getMany')
async getManyVendorBalance(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('vendorbalance','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'VendorBalance getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('vendorbalancedetail/getMany')
async getManyVendorBalanceDetail(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('vendorbalancedetail','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'VendorBalanceDetail getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

                                         // VENDOR CREDIT //
@Post('vendorcredit/create')
async createVendorCredit(@Body() data: any) {
  if (!data || !data.connectionId ) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('vendorcredit', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'Vendor Credit created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('vendorcredit/get')
  async getVendorCredit(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('vendorcredit','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Vendor Credit get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('vendorcredit/getMany')
async getManyVendorCredit(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('vendorcredit','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Vendor Credit getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('vendorcredit/update')
async updateVendorCredit(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null  ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('vendorcredit','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Vendor Credit updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('vendorcredit/delete')
async deleteVendorCredit(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('vendorcredit','delete','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'VendorExpenses Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('vendorExpenses/getMany')
async getManyVendorExpenses(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('vendorExpenses','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Vendor Credit getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}


@Post('accountlistdetail/getMany')
async getManyAccountListDetail(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('accountlistdetail','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'AccountListDetail getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('apagingdetail/getMany')
async getManyAPAgingDetail(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('apagingdetail','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'APAgingDetail getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}


@Post('apagingSummary/getMany')
async getManyAPAgingSummary(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('apagingSummary','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'APAgingSummary getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('aragingdetail/getMany')
async getManyARAgingDetail(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('aragingdetail','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'ARAgingDetail getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('aragingSummary/getMany')
async getManyARAgingSummary(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('aragingSummary','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'ARAgingSummary getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}


@Post('attachable/create')
async createAttachable(@Body() data: any) {
  if (!data || !data.connectionId) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('attachable', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'Attachable created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('attachable/get')
  async getAttachable(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('attachable','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Attachable get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('attachable/getMany')
async getManyAttachable(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('attachable','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Attachable getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('attachable/update')
async updateAttachable(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('attachable','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Attachable updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('attachable/delete')
async deleteAttachable(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('attachable','delete','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Attachable Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('attachable/download')
async downloadAttachable(@Body() data: any, @Res() res: Response) {
  if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('attachable', 'download', 'get', data,);
    if (result.status >= 400) {
      throw new HttpException(result.response || 'QuickBooks request failed', result.status,);
    }
    res.set({
      'Content-Type': result.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="attachable-${data.Id}"`,
    });
    return res.send(result.response);
  } 
  catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('attachable/upload')
@UseInterceptors(FileInterceptor('file'))
async uploadAttachable(@UploadedFile() file: any, @Body() data: any,) {
  if (!data || !data.connectionId) {
    throw new HttpException('connectionId is required', HttpStatus.BAD_REQUEST, );
  }
  if (!file) {
    throw new HttpException('file is required', HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('attachable', 'upload', 'post',{...data, file,},);
    if (result.status >= 400) {
      throw new HttpException(result.response || 'QuickBooks request failed',result.status,);
    }
    return {
      message: 'Attachable uploaded successfully',
      Response: result.response,
      Status: result.status,
    };
  } 
  catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('balancesheet/getMany')
async getBalanceSheet(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('balancesheet','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'BalanceSheet getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('batch/create')
async createBatch(@Body() data: any) {
  if (!data || !data.connectionId) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('batch', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'Batch created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}


@Post('bill/create')
async createBill(@Body() data: any) {
  if (!data || !data.connectionId ) {
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST,);
  }
  try {
    const result = await this.performQuickBooksAction('bill', 'create','post',data,);
    if (result.status >= 400) {
      throw new HttpException( result.response || 'QuickBooks request failed', result.status, );
    }
    return {
      message: 'Bill Credit created successfully',
      Response: result.response,
      Status: result.status,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

@Post('bill/get')
  async getBill(@Body() data: any) {
    if (!data || !data.connectionId || !data.Id) {
    throw new HttpException('connectionId and Id are required', HttpStatus.BAD_REQUEST,);
    }
      try{
        const result = await this.performQuickBooksAction('bill','get','get',data);
        if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
        return{
          message:'Bill Credit get executed successfully',
          Response:result.response,
          Status:result.status,
        }
      } catch (error) {
          if (error instanceof HttpException) {
            throw error;
          }

          throw new HttpException(
          error instanceof Error? error.message : 'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  }

  
@Post('bill/getMany')
async getManyBill(@Body() data:any){
  if(!data || !data.connectionId){
    throw new HttpException('connectionId is required',HttpStatus.BAD_REQUEST)
  }
  try{
    const result = await this.performQuickBooksAction('bill','getMany','get',data);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Bill Credit getMany executed successfully',
      response:result.response,
      status:result.status,
    }
  }
  catch(error){
    if(error instanceof HttpException){
      throw error;
    }
    throw new HttpException(
      error instanceof Error?error.message:'Internal swerver error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}

@Post('bill/update')
async updateBill(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null  ){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('bill','update','post',data,);
     if (result.status >= 400) {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Bill Credit updated successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}

@Post('bill/delete')
async deleteBill(@Body() data:any){
  if(!data || !data.connectionId || !data.Id || data.SyncToken === undefined || data.SyncToken === null){
  throw new HttpException('connectionId, Id and SyncToken are required', HttpStatus.BAD_REQUEST,);
  }
  try{
    const result = await this.performQuickBooksAction('bill','delete','post',data,);
     if(result.status >= 400 || result.response?.Fault)  {
  throw new HttpException( result.response || 'QuickBooks request failed',result.status,);
}
    return{
      message:'Bill Deleted successfully',
      Response:result.response,
      Status:result.status,
    }
  }
  catch(error){
   if(error instanceof HttpException){
    throw error;
   }
   throw new HttpException(
    error instanceof Error?error.message:'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
   );
  }
}


  public async curl(module: string, action: string, method: string, data: any,): Promise<any> {
    try {
      const connectionId =  data.connectionId;
      const connection = await this.quickBooksConnections.findOne({
          where: {id: connectionId,},
        });
      if (!connection) {
        throw new HttpException('Connection Not Found',
          HttpStatus.NOT_FOUND,
        );
      }
      const accessToken = connection.accessToken;
      const realmId = connection.realmId;
      const baseUrl = process.env.QUICKBOOKS_ENV ==='production'? process.env.QUICKBOOKS_PRODUCTION_BASE_URL : process.env .QUICKBOOKS_SANDBOX_BASE_URL;
      
      let url = `${baseUrl}/v3/company/${realmId}/${module}`;
      if(action==='getMany'){
        url =`${baseUrl}/v3/company/${realmId}/query`;
      }
      if (action ==='get' && data.Id) {
        url += `/${data.Id}`;
      }
      if(action ==='delete'){
        url +=`?operation=delete`;
      }
       if(action ==='void'){
        url +=`?operation=void`;
      }
      if(action === 'send' && data.Id){
        url +=`/${data.Id}/send`
          if (data.sendTo) {
            url += `?sendTo=${encodeURIComponent(data.sendTo)}&minorversion=75`;
          }
      }
      if(action === 'pdf' && data.Id){
        url +=`/${data.Id}/pdf`;
      }
      if(action === 'getAll'){
         url += '?minorversion=40';
      }
      if (action === 'getByParentId' && data.parentId) {
         url += `/${data.parentId}/children?minorversion=40`;
      }
      if (action === 'getByLevel' && data.level) {
         url += `?level=${encodeURIComponent(data.level)}&minorversion=40`;
      }
      if(module === 'taxservice' && action ==='create'){
        url +=`/taxcode`;
      }
      if (module === 'taxsummary' && action === 'getMany') {
         url = `${baseUrl}/v3/company/${realmId}/reports/TaxSummary`;
      }
       if (module === 'transactionlist' && action === 'getMany') {
         url = `${baseUrl}/v3/company/${realmId}/reports/TransactionList`;
      }
        if (module === 'transactionlistbyvendor' && action === 'getMany') {
         url = `${baseUrl}/v3/company/${realmId}/reports/TransactionListByVendor`;
      }
      if (module === 'transactionlistbycustomer' && action === 'getMany') {
         url = `${baseUrl}/v3/company/${realmId}/reports/TransactionListByCustomer`;
      }
       if (module === 'transactionlistwithsplits' && action === 'getMany') {
         url = `${baseUrl}/v3/company/${realmId}/reports/TransactionListWithSplits`;
      }
      if ((module === 'taxagency'|| module==='term') && action === 'create') {
         url += '?minorversion=40';
      }
      if ((module === 'taxagency'|| module==='term')&& action === 'get' && data.Id) {
          url += '?minorversion=40';
      }
      if (module === 'term' && action === 'update') {
         url += '?minorversion=40';
      }
      if (action === 'delete') {
         url += `?operation=delete&minorversion=75`;
      }
       if ((module === 'transfer' || module==='vendorcredit') && action === 'delete' ) {
        url += '&minorversion=75';
      }
      if (module === 'transfer'|| module==='vendor' || module==='vendorcredit') {
        url += '?minorversion=75';
      }
      if ((module === 'transfer' || module==='vendor' || module==='vendorcredit' || module === 'bill') && action === 'get' && data.Id) {
        url += '?minorversion=75';
      }
      if (module === 'transfer' && action === 'delete') {
        url += '&minorversion=75';
      }
      if (module === 'trialbalance' && action === 'getMany') {
         url = `${baseUrl}/v3/company/${realmId}/reports/TrialBalance`;
      }
      if (module === 'vendorbalance' && action === 'getMany') {
          url = `${baseUrl}/v3/company/${realmId}/reports/VendorBalance`;
      }
      if (module === 'vendorbalancedetail' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/VendorBalanceDetail`;
      }
      if (module === 'vendorExpenses' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/VendorExpenses`;
      }
      if (module === 'accountlistdetail' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/AccountList`;
      }
      if (module === 'apagingdetail' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/AgedPayableDetail`;
      }
      if (module === 'apagingSummary' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/AgedPayables`;
      }
      if (module === 'aragingdetail' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/AgedReceivableDetail`;
      }
      if (module === 'aragingSummary' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/AgedReceivables`;
      }
      if (module === 'attachable' && action === 'get' && data.Id) {
        url = `${baseUrl}/v3/company/${realmId}/attachable/${data.Id}?minorversion=75`;
      }
      if (module === 'attachable' && action === 'delete') {
        url = `${baseUrl}/v3/company/${realmId}/attachable?operation=delete&minorversion=75`;
      }
      if (module === 'attachable' && action === 'download' && data.Id) {
        url = `${baseUrl}/v3/company/${realmId}/download/${data.Id}?minorversion=75`;
      }
      if ( module === 'attachable' && (action === 'create' || action === 'update')) {
        url = `${baseUrl}/v3/company/${realmId}/attachable?minorversion=75`;
      }
      if (module === 'attachable' && action === 'upload') {
        url = `${baseUrl}/v3/company/${realmId}/upload?minorversion=75`;
      }
      if (module === 'balancesheet' && action === 'getMany') {
        url = `${baseUrl}/v3/company/${realmId}/reports/BalanceSheet`;
      }
      if (module === 'batch' && action === 'create') {
        url = `${baseUrl}/v3/company/${realmId}/batch?minorversion=75`;
      }
      if(module==='bill' && (action ==='create'|| action==='update')){
        url += '?minorversion=75';
      }

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type':action==='getMany'?'text/plain':action==='send'?'application/octet-stream':'application/json',
        Accept:action==='pdf'?'application/pdf':action==='download'?'*/*':'application/json',
      };
      const options: any = {
        method: method,
        url: url,
        headers: headers,
        maxRedirects: 0,
        validateStatus: (status: number) => status >= 200 && status < 400,
        ...((action === 'pdf' || action === 'download') && {
          responseType: 'arraybuffer',
        }),
      };

      const {connectionId: removedConnectionId,...requestData } = data;

      if (module === 'attachable' && action === 'upload') {
            const form = new FormData();
            form.append('file', data.file.buffer, {
              filename: data.file.originalname,
              contentType: data.file.mimetype,
            });
            form.append('Attachable', JSON.stringify({
                FileName: data.file.originalname,
                ContentType: data.file.mimetype,
              }),
            );
            options.data = form;
            options.headers = {...options.headers, ...form.getHeaders(),};
      }
      else if((module==='transactionlist' || module==='transactionlistbyvendor') && action==='getMany'){
          options.params={ start_date: requestData.start_date,  end_date: requestData.end_date, minorversion: 40,};
      }
      else if((module==='transactionlistbycustomer' || module==='transactionlistwithsplits'|| module==='trialbalance' || module==='vendorbalance'|| module==='vendorbalancedetail' || module==='vendorExpenses')&& action==='getMany'){
          options.params={ start_date: requestData.start_date,  end_date: requestData.end_date, minorversion: 75,};
      }
      else if(module==='taxsummary' && action==='getMany'){
          options.params={agency_id: requestData.agency_id, start_date: requestData.start_date,  end_date: requestData.end_date,};
      }
      else if ( (module === 'transfer' || module==='vendor' || module==='vendorcredit' || module==='attachable' || module === 'bill')&& action === 'getMany') {
        options.params ={ query:requestData.query, minorversion:75};
      }
      else if ((module === 'accountlistdetail' || module==='apagingdetail' || module==='apagingSummary' || module==='aragingdetail' || module==='aragingSummary' || module==='balancesheet') && action === 'getMany') {
        options.params = { minorversion: 75,};
      }
      else if (action === 'getMany') {
        options.params ={ query:requestData.query, minorversion:40};
      }
      else if(action === 'send' || action==='pdf' || action ==='getAll' || action==='download'){
      //send API does not require request body
      }
        else {
        options.data = requestData;
      }
      try {
        const response = await axios(options);
        return {
          response: response.data,
          status: response.status,
          contentType: response.headers['content-type'],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (
            error.response?.status === 401
          ) {
            const refreshedConnection = await this.quickBooksConnections.findOne({
                where: { id: connectionId,},
              });

            if (!refreshedConnection) {
              throw new HttpException('Connection Not Found',
                HttpStatus.NOT_FOUND,
              );
            }
            await this.refreshQuickBooksToken(refreshedConnection,);
            options.headers.Authorization = `Bearer ${refreshedConnection.accessToken}`;
            const retryResponse = await axios(options);
            return {
              response: retryResponse.data,
              status: retryResponse.status,
              contentType: retryResponse.headers['content-type'],
            };
          }
          return {
            response: error.response?.data,
            status: error.response?.status || 500,
          };
        }
        throw error;
      }
    } catch (error) {
      console.log(error);

      if (axios.isAxiosError(error)) {
        return {
          response: error.response?.data,
          status: error.response?.status ||500,
        };
      }

      throw error;
    }
  }

  private async performQuickBooksAction( module: string, action: string, method: string, data: any,): Promise<any> {
    const resData =  await this.curl( module, action, method, data,);
     return resData;
  }
}