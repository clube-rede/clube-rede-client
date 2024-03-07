'use client'

import CurrencyInput from 'react-currency-input-field'
import InputMask from "react-input-mask"
import { useForm, useFieldArray } from 'react-hook-form'
import { useParams, useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button'
import DashboardLayout from '@/components/DashboardLayout'
import { DetailsRow } from '@/components/DetailsRow'
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { InputContainer } from '@/components/InputContainer'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { sendRequest } from '@/lib/sendRequest'
import { STATUS } from '@/lib/enums'
import { useToast } from '@/components/ui/use-toast'
import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { applyCurrencyMaskReturningString, transformCurrencyNumberToString, transformCurrencyStringToNumber, validateCurrencyInput } from '@/lib/utils'
import { v4 as uuid } from 'uuid'
import { Separator } from '@radix-ui/react-select'

const newOrderItemFormSchema = z.object({
  medicineName: z
    .string({ required_error: 'O campo Nome do Medicamento é obrigatório.' })
    .min(1, { message: 'O campo Nome do Medicamento deve ter pelo menos 1 caracter.' }),
  medicineType: z
    .string({ required_error: 'O campo Tipo do Medicamento é obrigatório.' })
    .min(1, { message: 'O campo Tipo do Medicamento deve ter pelo menos 1 caracter.' }),
  quantity: z.coerce
    .number({
      required_error: 'O campo Quantidade é obrigatório.',
      invalid_type_error: 'O campo Quantidade deve ser um número.'
    })
    .gte(1, { message: 'O campo Quantidade deve ser maior ou igual a 1.' }),
  listPrice: z
    .number({
      required_error: 'O campo Valor de Tabela é obrigatório.',
      invalid_type_error: 'O campo Valor de Tabela deve ser um número.'
    })
    .gte(0, { message: 'O campo Valor de Tabela deve ser maior ou igual a 0.' }),
  discountPrice: z
    .number({
      required_error: 'O campo Valor de Tabela é obrigatório.',
      invalid_type_error: 'O campo Valor de Tabela deve ser um número.'
    })
    .gte(0, { message: 'O campo Valor de Tabela deve ser maior ou igual a 0.' }),
})

type NewOrderItemFormSchema = z.infer<typeof newOrderItemFormSchema>

const newOrderFormSchema = z.object({
  memberId: z
    .string({ required_error: 'O campo ID do Associado é obrigatório.' })
    .uuid({ message: 'O campo ID do Associado deve ser um UUID válido.' }),
  statusId: z.coerce
    .number({ required_error: 'O campo Status é obrigatório.' })
    .gte(1, { message: 'O campo Status deve 1 (ativo), 2 (inativo) ou 3 (excluído).' })
    .lte(3, { message: 'O campo Status deve 1 (ativo), 2 (inativo) ou 3 (excluído).' }),
  totalValue: z.coerce
    .number({
      required_error: 'O campo Valor Total é obrigatório.',
      invalid_type_error: 'O campo Valor Total deve ser um número.'
    })
    .gte(0, { message: 'O campo Valor Total deve ser maior ou igual a 0.' }),
  totalSavings: z.coerce
    .number({
      required_error: 'O campo Economia Total é obrigatório.',
      invalid_type_error: 'O campo Economia Total deve ser um número.'
    })
    .gte(0, { message: 'O campo Economia Total deve ser maior ou igual a 0.' }),
  isRecurring: z.coerce
    .boolean({ required_error: 'O campo Compra Recorrente é obrigatório.' }),
  items: z.array(newOrderItemFormSchema)
}).refine((fields) => fields.items.length > 0, {
  path: ['items'],
  message: 'Deve haver pelo menos um item no pedido.'
})

type NewOrderFormSchema = z.infer<typeof newOrderFormSchema>

interface INewOrderItem {
  medicineName: string
  medicineType: string
  quantity: number
  listPrice: number
  discountPrice: number
}
interface INewOrder {
  memberId: string
  statusId: number
  totalValue: number
  totalSavings: number
  isRecurring: boolean
  items: INewOrderItem[]
}

const NEW_ITEM_FORM_DEFAULT_VALUES: NewOrderItemFormSchema = {
  medicineName: '',
  medicineType: '',
  quantity: 1,
  listPrice: 0,
  discountPrice: 0
}

const NEW_ORDER_FORM_DEFAULT_VALUES: NewOrderFormSchema = {
  memberId: '',
  statusId: STATUS.Ativo,
  totalValue: 0,
  totalSavings: 0,
  isRecurring: false,
  items: []
}

export default function RegisterOrder() {
  const [statusId, setStatusId] = useState<number>(1)
  const [isRecurring, setIsRecurring] = useState<boolean>(false)
  const [totalValue, setTotalValue] = useState<string>('')
  const [totalSavings, setTotalSavings] = useState<string>('')
  const [items, setItems] = useState<Array<INewOrderItem & { id: string }>>([])
  const [isAddItemButtonDisabled, setIsAddItemButtonDisabled] = useState<boolean>(true)

  const [medicineName, setMedicineName] = useState<string>('')
  const [medicineType, setMedicineType] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [listPrice, setListPrice] = useState<string>('')
  const [discountPrice, setDiscountPrice] = useState<string>('')
  const [isPostOrderButtonDisabled, setIsPostOrderButtonDisabled] = useState<boolean>(true)

  const params = useParams()
  const { back } = useRouter()
  const { toast } = useToast()

  const postOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const newOrderData: NewOrderFormSchema = {
      memberId: params.id as string,
      statusId,
      isRecurring,
      items,
      totalSavings: transformCurrencyStringToNumber(totalSavings),
      totalValue: transformCurrencyStringToNumber(totalValue)
    }

    const response = await sendRequest({
      endpoint: '/order',
      method: 'POST',
      data: newOrderData
    })

    if (response.error) {
      toast({
        description: response.message,
        variant: 'destructive'
      })
    } else {
      toast({
        description: response.message,
        variant: 'success'
      })
    }

  back()
  }

  const resetItemForm = () => {
    setMedicineName('')
    setMedicineType('')
    setQuantity(1)
    setListPrice('')
    setDiscountPrice('')
  }

  const addItemToOrder = () => {
    setItems((prev) => [
      ...prev,
      {
        medicineName,
        medicineType,
        quantity,
        listPrice: transformCurrencyStringToNumber(listPrice),
        discountPrice: transformCurrencyStringToNumber(discountPrice),
        id: uuid()
      }
    ])

    resetItemForm()
  }

  const removeItemFromOrder = (id: string) => {
    const item = items.find((item) => item.id === id)

    setItems((prev) =>  prev.filter((item) => item.id !== id))

    setTotalValue((prev) => (
      transformCurrencyNumberToString(
        transformCurrencyStringToNumber(prev || '0') -
        (item?.listPrice || 0)
      )
    ))
  }

  const validateOrderItem = (orderFields: INewOrderItem): boolean => {
    if (
      orderFields.medicineName.length >= 3
      && orderFields.medicineType.length >= 3
      && orderFields.quantity > 0
      && (
        orderFields.listPrice
        && validateCurrencyInput(transformCurrencyNumberToString(orderFields.listPrice))
      )
      && (
        orderFields.discountPrice
        && validateCurrencyInput(transformCurrencyNumberToString(orderFields.discountPrice))
      )
    ) return true
    return false
  }

  const validateOrder = (order: Omit<INewOrder, 'isRecurring' | 'statusId'>): boolean => {
    if (
      order.memberId.length > 0
      && (
        order.totalValue
        && validateCurrencyInput(transformCurrencyNumberToString(order.totalValue))
      )
      && (
        order.totalSavings
        && validateCurrencyInput(transformCurrencyNumberToString(order.totalSavings))
      )
      && (
        order.items.length > 0
        && order.items.every((item) => validateOrderItem(item))
      )
    ) return true
    return false
  }

  // Valida item
  useEffect(() => {
    const isItemValid = validateOrderItem({
      medicineName,
      medicineType,
      quantity,
      listPrice: transformCurrencyStringToNumber(listPrice),
      discountPrice: transformCurrencyStringToNumber(discountPrice)
    })
    setIsAddItemButtonDisabled(!isItemValid)
  }, [medicineName, medicineType, quantity, listPrice, discountPrice])

  // Valida pedido
  useEffect(() => {
    const isOrderValid = validateOrder({
      memberId: params.id as string,
      totalValue: transformCurrencyStringToNumber(totalValue),
      totalSavings: transformCurrencyStringToNumber(totalSavings),
      items
    })
    setIsPostOrderButtonDisabled(!isOrderValid)
  }, [totalValue, totalSavings, items])

  // Atualiza totalValue
  useEffect(() => {
    setTotalValue(items.reduce((acc, item) => acc + (item.quantity * item.listPrice), 0).toString())
  }, [items])

  // Atualiza totalSavings
  useEffect(() => {
    setTotalSavings(
      (
        transformCurrencyStringToNumber(totalValue)
        - (items.reduce((acc, item) => acc + (item.quantity * item.discountPrice), 0))
      ).toFixed(2)
    )
  }, [totalValue])

  return (
    <DashboardLayout title="Cadastrar Novo Pedido">
        <form
          className='flex flex-col my-4 gap-4'
          onSubmit={postOrder}
        >
          <DetailsRow>
            <InputContainer size="w-1/4">
              <Label htmlFor="isRecurring">Compra Recorrente</Label>
              <Select onValueChange={(e) => setIsRecurring(e === 'true')} value={(isRecurring).toString()}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Não</SelectItem>
                  <SelectItem value="true">Sim</SelectItem>
                </SelectContent>
              </Select>
            </InputContainer>
            <InputContainer size="w-1/4">
              <Label htmlFor="isRecurring">Status</Label>
              <Select onValueChange={(e) => setStatusId(parseInt(e))} value={(statusId).toString()}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{STATUS[1]}</SelectItem>
                  <SelectItem value="2">{STATUS[2]}</SelectItem>
                  <SelectItem value="3">{STATUS[3]}</SelectItem>
                </SelectContent>
              </Select>
            </InputContainer>
            <InputContainer  size="w-1/4">
              <Label htmlFor="totalValue">Valor Total</Label>
              <Input
                prefix='R$'
                className="bg-background"
                id="totalValue"
                name="totalValue"
                onChange={(e) => setTotalValue(applyCurrencyMaskReturningString(e.target.value))}
                value={totalValue}
              />
              {
                !totalValue && <span className="text-red-500 text-xs">
                  Campo brigatório.
                </span>
              }
            </InputContainer>
            <InputContainer  size="w-1/4">
              <Label htmlFor="totalSavings">Valor com Desconto</Label>
              <Input
                prefix='R$'
                className="bg-background"
                id="totalSavings"
                name="totalSavings"
                onChange={(e) => setTotalSavings(applyCurrencyMaskReturningString(e.target.value))}
                value={totalSavings}
              />
              {
                !totalSavings && <span className="text-red-500 text-xs">
                  Campo brigatório.
                </span>
              }
            </InputContainer>
          </DetailsRow>

          <DetailsRow>
            <Label>Items do pedido:</Label>
          </DetailsRow>

          {
            items.map((item) => (
                <div className='flex bg-white p-4 rounded-md border flex-col gap-4' key={uuid()}>
                  <DetailsRow className='bg-background px-4 py-2 rounded-md border'>
                    <InputContainer size="w-1/2">
                      <Label className="text-sm font-semibold" htmlFor="medicineName">Nome do Medicamento</Label>
                      <span>{item.medicineName}</span>
                    </InputContainer>
                    <InputContainer size="w-1/2">
                      <Label className="text-sm font-semibold" htmlFor="medicineType">Tipo do Medicamento</Label>
                      <span>{item.medicineType}</span>
                    </InputContainer>
                  </DetailsRow>

                  <DetailsRow className='bg-background px-4 py-2 gap-6 rounded-md border'>
                    <InputContainer size="w-1/3">
                      <Label className="text-sm font-semibold" htmlFor="quantity">Quantidade</Label>
                      <span>{item.quantity}</span>
                    </InputContainer>
                    <InputContainer size="w-1/3">
                      <Label className="text-sm font-semibold" htmlFor="listPrice">Valor de Tabela</Label>
                      <span>R$ {transformCurrencyNumberToString(item.listPrice)}</span>
                    </InputContainer>
                    <InputContainer size="w-1/3">
                      <Label className="text-sm font-semibold" htmlFor="discountPrice">Valor com Desconto</Label>
                      <span>R$ {transformCurrencyNumberToString(item.discountPrice)}</span>
                    </InputContainer>
                  </DetailsRow>

                  <div className="flex justify-end">
                    <Button
                      className="gap-4"
                      onClick={() => removeItemFromOrder(item.id)}
                      type='button'
                      variant="destructive"
                    >
                      <Minus /> Remover item
                    </Button>
                  </div>
                </div>
            ))
          }

          <div className="w-full flex">
            <AlertDialog>
              <AlertDialogTrigger className='inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary uppercase text-secondary-foreground shadow-sm hover:bg-secondary/80 py-1 px-8 gap-4 h-9'>
                <Plus /> Adicionar item
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Adicionar item</AlertDialogTitle>
                </AlertDialogHeader>

                <DetailsRow>
                  <InputContainer size="w-1/2">
                    <Label htmlFor="medicineName">Nome do Medicamento</Label>
                    <Input
                      className="bg-background"
                      id="medicineName"
                      name="medicineName"
                      onChange={(e) => setMedicineName(e.target.value)}
                      value={medicineName}
                    />
                    {
                      !medicineName && <span className="text-red-500 text-xs">
                        Campo brigatório.
                      </span>
                    }
                  </InputContainer>
                  <InputContainer size="w-1/2">
                    <Label htmlFor="medicineType">Tipo do Medicamento</Label>
                    <Input
                      className="bg-background"
                      id="medicineType"
                      name="medicineType"
                      onChange={(e) => setMedicineType(e.target.value)}
                      value={medicineType}
                    />
                    {
                      !medicineType && <span className="text-red-500 text-xs">
                        Campo brigatório.
                      </span>
                    }
                  </InputContainer>
                </DetailsRow>

                <DetailsRow>
                  <InputContainer size="w-1/3">
                    <Label htmlFor="quantity">Quantidade</Label>
                    <Input
                      className="bg-background"
                      id="quantity"
                      name="quantity"
                      onChange={(e) => setQuantity(parseInt(e.target.value.replace(/[^\d.]/g, '')))}
                      type="number"
                      value={quantity}
                    />
                    {
                      !quantity && <span className="text-red-500 text-xs">
                        Campo brigatório.
                      </span>
                    }
                  </InputContainer>
                  <InputContainer size="w-1/3">
                    <Label htmlFor="listPrice">Valor de Tabela</Label>
                    <Input
                      className="bg-background"
                      id="listPrice"
                      name="listPrice"
                      onChange={(e) => setListPrice(applyCurrencyMaskReturningString(e.target.value))}
                      value={listPrice}
                    />
                    {
                      !listPrice && <span className="text-red-500 text-xs">
                        Campo brigatório.
                      </span>
                    }
                  </InputContainer>
                  <InputContainer size="w-1/3">
                    <Label htmlFor="discountPrice">Valor com Desconto</Label>
                    <Input
                      className="bg-background"
                      id="discountPrice"
                      name="discountPrice"
                      onChange={(e) => setDiscountPrice(applyCurrencyMaskReturningString(e.target.value))}
                      value={discountPrice}
                    />
                    {
                      !discountPrice && <span className="text-red-500 text-xs">
                        Campo brigatório.
                      </span>
                    }
                  </InputContainer>
                </DetailsRow>

                <AlertDialogFooter>
                  <AlertDialogCancel onClick={resetItemForm}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={isAddItemButtonDisabled} onClick={addItemToOrder}>
                    Inserir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Button
            className="my-4"
            disabled={isPostOrderButtonDisabled}
            type='submit'
          >
            Cadastrar Pedido
          </Button>
        </form>
    </DashboardLayout>
  )
}
