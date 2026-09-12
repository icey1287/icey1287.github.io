# CookMind

**从 Transformer 结构到训练与对齐的小型语言模型实践**

[GitHub ↗](https://github.com/icey1287/CookMind)

CookMind 围绕一个 Decoder-only Transformer 展开，把模型结构、数据处理和不同阶段的训练脚本放在同一个学习项目里。除了调用模型，也向下一层看：Token 如何进入网络、损失如何产生，以及参数究竟如何被更新。

技术栈：`Python` · `PyTorch` · `Transformers` · `DDP` · `uv`

## 模型由哪些部分构成

模型主体包含配置类、Embedding、RMSNorm、RoPE、GQA 注意力、FFN、多层 Transformer Block 和 Causal LM 输出头。

```text
Token IDs
   ↓
Embedding
   ↓
Transformer Block × N
   ├─ RMSNorm → RoPE / GQA → 残差连接
   └─ RMSNorm → FFN / 可选 MoE → 残差连接
   ↓
最终归一化 → lm_head → Logits / Loss
```

默认配置采用 512 维隐藏状态、8 层 Transformer、8 个 Query 头与 2 个 Key / Value 头，词表大小为 6,400。结构和训练参数通过配置管理，便于阅读不同模块之间的张量关系。

## 注意力、位置与前馈网络

- **RMSNorm**：围绕均方根做归一化，保留可学习缩放参数。
- **GQA**：让多组 Query 共享 Key / Value，代码中将注意力头和 KV 头分开配置。
- **RoPE / YaRN**：对 Query 和 Key 注入旋转位置编码，并提供推理位置缩放配置。
- **SiLU FFN**：在注意力聚合之后进行逐 Token 的非线性变换。
- **可选 MoE**：支持路由专家、共享专家、Top-k 分配与负载均衡辅助损失；默认走 Dense FFN。

## 不同训练目标的代码路径

| 阶段 | 脚本 | 关注的问题 |
| --- | --- | --- |
| 预训练 | `train_pretrain.py` | 从文本学习下一 Token 预测 |
| 全量 SFT | `train_full_sft.py` | 将对话数据用于监督微调 |
| LoRA | `train_lora.py` | 通过低秩适配器进行参数高效微调 |
| DPO | `train_dpo.py` | 对比同一问题的 chosen / rejected 回答 |
| GRPO | `train_grpo.py` | 同一提示生成多条回答，按组内相对奖励更新 |

DPO 路径分别计算策略模型与冻结参考模型的回复概率，在有效回复位置上应用掩码并构造偏好损失。GRPO 路径则围绕采样、奖励和组内比较展开，奖励计算包含模型评分，以及可选的推理回复格式评分。

## 训练脚本背后的工程细节

预训练脚本把参数解析、随机种子、分布式初始化、混合精度、DataLoader、优化器、断点恢复、训练循环和权重保存串起来。梯度累积与学习率调整写在实际训练步骤中，训练工具由 `trainer_utils.py` 统一组织。

数据层集中在 `dataset/lm_dataset.py`，模型代码集中在 `model/`，训练入口集中在 `trainer/`。这样可以对照观察：改变训练目标时，哪些模型组件可以复用，哪些样本格式和损失计算需要调整。

## 让实现成为学习笔记

仓库同时记录了注意力、Token / Embedding、Logits、交叉熵与反向传播等学习笔记。代码中保留了较细的中文注释，阅读路径可以从一个张量的形状开始，一直追到一次参数更新。

CookMind 的重点是把模型结构与训练机制放到可阅读、可修改的代码中理解，让“知道这些术语”进一步变成“知道它们在程序里如何协作”。
