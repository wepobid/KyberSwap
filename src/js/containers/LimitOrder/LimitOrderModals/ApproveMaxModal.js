import React from "react"
import { Modal } from "../../../components/CommonElement"
import { connect } from "react-redux"
import { getTranslate } from 'react-localize-redux'
import * as limitOrderActions from "../../../actions/limitOrderActions"
import * as accountActions from "../../../actions/accountActions"
import * as converter from "../../../utils/converter"
import { getWallet } from "../../../services/keys"
import {FeeDetail} from "../../../components/CommonElement"
import BLOCKCHAIN_INFO from "../../../../../env"

@connect((store, props) => {
  const account = store.account.account
  const translate = getTranslate(store.locale)
  const tokens = store.tokens.tokens
  const limitOrder = store.limitOrder
  const ethereum = store.connection.ethereum
  const global = store.global

  return {
    translate, limitOrder, tokens, account, ethereum, global
  }
})
export default class ApproveMaxModal extends React.Component {
  constructor() {
    super()
    this.state = {
      err: "",
      isFetchGas: false,
      gasLimit: 0,
      isConfirming: false      
    }
  }

  componentDidMount = () =>{
    this.setState({
      isFetchFee: true,
      gasLimit: this.props.getMaxGasApprove(),
    })
    
    this.getGasApprove()
  }

  async getGasApprove(){
      // estimate gas approve
      try{
        var ethereum = this.props.ethereum
        var dataApprove = await ethereum.call("approveTokenData", this.props.sourceToken.address, converter.biggestNumber(), BLOCKCHAIN_INFO.kyberswapAddress)
        var txObjApprove = {
          from: this.props.account.address,
          to: this.props.sourceToken.address,
          data: dataApprove,
          value: '0x0',
        }
        var gas_approve = await ethereum.call("estimateGas", txObjApprove)
        gas_approve = Math.round((gas_approve + 15000) * 120 / 100)
        this.setState({
          isFetchFee: false,
          gasLimit: gas_approve
        })
      }catch(err){
        console.log(err)
        this.setState({
          isFetchFee: false            
        })
      }
      
  }

  async onSubmit() {
    this.props.global.analytics.callTrack("trackLimitOrderClickApprove", "Max", this.props.sourceToken.symbol);
    if (this.state.isConfirming || this.state.isFetchGas) return
    this.setState({
      err: "",
      isConfirming: true
    })

    var wallet = getWallet(this.props.account.type)
    var password = ""
    try {
      var nonce = this.props.account.getUsableNonce()
      var txHash = await wallet.broadCastTx("getAppoveToken", this.props.ethereum, this.props.sourceToken.address, 0, nonce, this.state.gasLimit,
        converter.toHex(converter.gweiToWei(this.props.limitOrder.gasPrice)), this.props.account.keystring, password, this.props.account.type, this.props.account.address, BLOCKCHAIN_INFO.kyberswapAddress)

      this.props.dispatch(limitOrderActions.saveApproveMaxTx(this.props.sourceToken.symbol, txHash));
      this.props.dispatch(accountActions.incManualNonceAccount(this.props.account.address))
      
      this.props.goToNextPath();
    } catch (err) {
      console.log(err)
      this.setState({ err: err.toString(), isConfirming: false  })
    }
  }
  
  msgHtml = () => {
    if (this.state.isConfirming && this.props.account.type !== 'privateKey') {
      return <span className={"common__slide-up"}>{this.props.translate("modal.waiting_for_confirmation") || "Waiting for confirmation from your wallet"}</span>
    } else {
      return this.props.translate("modal.press_approve") || "Press approve to continue";
    }
  }

  errorHtml = () => {
    if (this.state.err) {
      return (
        <React.Fragment>
          <div className={'modal-error message-error common__slide-up'}>
            {this.state.err}
          </div>
        </React.Fragment>
      )
    }
    
    return ""
  }

  closeModal = () => {
    if (this.state.isConfirming) return
    this.props.closeModal();
  }

  contentModal = () => {
    return (
      <div className="approve-modal">
        <div className="title">{this.props.translate("modal.approve_token") || "Approve Token"}</div>
        <div className="x" onClick={this.closeModal}>&times;</div>
        <div className="content with-overlap">
          <div className="row">
            <div>
              <div>
                <div className="message">
                  {this.props.translate("modal.approve_exchange_limit_order", { token: this.props.sourceToken.symbol })
                  || `You need to grant permission for KyberSwap Limit Order to interact with ${this.props.sourceToken.symbol} with this address`}
                </div>
                <div class="info tx-title theme__background-222">
                  <div className="address-info">
                    <div>{this.props.translate("modal.address") || "Address"}</div>
                    <div className={"theme__text-7"}>{this.props.account.address}</div>
                  </div>
                </div>
                <FeeDetail 
                      translate={this.props.translate} 
                      gasPrice={this.props.limitOrder.gasPrice} 
                      gas={this.state.gasLimit}
                      isFetchingGas={this.state.isFetchGas}                      
                    />
              </div>
              {this.errorHtml()}
            </div>

          </div>
        </div>
        <div className="overlap theme__background-2">
          <div className="input-confirm input-confirm--approve">
            <div>{this.msgHtml()}</div>
            <div>
              <div className={`button process-submit next ${this.state.isConfirming ? "btn--disabled" : ""}`} onClick={this.onSubmit.bind(this)}>
                {this.props.translate("modal.approve").toLocaleUpperCase() || "Approve".toLocaleUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  render() {
    return (
      <Modal
        className={{
          base: 'reveal medium confirm-modal',
          afterOpen: 'reveal medium confirm-modal'
        }}
        isOpen={true}
        onRequestClose={this.closeModal}
        contentLabel="approve token"
        content={this.contentModal()}
        size="medium"
      />
    )
  }
}
